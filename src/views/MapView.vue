<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { Ref } from 'vue'
import maplibregl from 'maplibre-gl'
import type { Map, CustomLayerInterface, LngLat, LngLatLike } from 'maplibre-gl'
import * as THREE from 'three'
import earcut from 'earcut'
import { v5 as uuidv5 } from 'uuid'
import MaplibreTerradrawControl from '@watergis/maplibre-gl-terradraw'

import Modal from '@/components/Modal.vue'
import { createFeatureWithGeometry } from '@/utils/buildingCreation'
import { sortCoordinatesByAngle } from '@/utils/coordinateHandling'

import { useCjStore } from '@/stores/cjStore'
import { singleSelStore, multiSelStore } from '@/stores/selectionStore'
import { useMapStore, useSemanticColorsStore } from '@/stores/mapStore'
import { useJobResultsStore } from '@/stores/jobResultsStore'
import { useAdditionalInfoStore } from '@/stores/additionalInfoStore'

import type { CityJSONFeature, CityObject, CityJSONDocument, RoofType } from '@/types/cityjson'
import type {
  BuildingFormParams,
  MapWatchers,
  SemanticInfo,
  ThreeJsLayer,
  TerraDrawFeature,
  TerraDrawMode,
} from '@/types/mapView'
import type { Coordinate } from '@/utils/coordinateHandling'
import type { Shell, MultiSurfaceGeom, SolidGeom, MultiSolidGeom } from '@/types/geoms'

const NAMESPACE = uuidv5('twin-city', uuidv5.DNS)
const showModal = ref<boolean>(false)
const params = ref<BuildingFormParams>({
  id: '',
  buildingHeight: 0,
  roofType: '',
  roofHeight: 0,
  roofOrientation: 0,
})
const showLegend = ref<boolean>(false)
const showLabels = ref<boolean>(true)
let buildingCoordiantes: { x: number; y: number; z: number }[] = []

const cjStore = useCjStore()
const semanticColorsStore = useSemanticColorsStore()
const sSelStore = singleSelStore()
const mSelStore = multiSelStore()
const mapStore = useMapStore()
const jobResultsStore = useJobResultsStore()
const additionalInfoStore = useAdditionalInfoStore()

const isMounted = ref<boolean>(false)
const isInitialized = ref<boolean>(false)
mapStore.activeOperation = null
mapStore.canSwitchOperation = true

let map: Map | null = null
let scene: THREE.Scene | null = null
let epsgOrigin: [number, number] | null = null
let originHeight: number | null = null
let convergenceAngle: number | null = null
let rotationMatrix: THREE.Matrix4 | null = null
let drawControl: MaplibreTerradrawControl | null = null
let currentViewBounds: [number, number, number, number] | null = null // [minX, minY, maxX, maxY]
let lastOriginUpdate: number = 0
const ORIGIN_UPDATE_THRESHOLD = 100
let drawInstance: ReturnType<
  typeof MaplibreTerradrawControl.prototype.getTerraDrawInstance
> | null = null
let mapCameraManager: MapCameraManager | null = null
const watchers: MapWatchers = {
  cjFeatures: null,
  activeOperation: null,
  saveCamera: null,
  loadCamera: null,
  selFeatures: null,
  jumpTargetLamp: null,
  pictureLamp: null,
  showMap: null,
  selectedParameter: null,
  showLabels: null,
}

const availableParameters = ref<string[]>(['None'])
const selectedParameter = ref<string>('None')
const currentParameterRange: Ref<{ min: number | null; max: number | null }> = ref({
  min: null,
  max: null,
})

// Map of process sum values for each process result, keyed by jobId
const processSumMaps = computed(() => {
  const maps: Record<string, Record<string, number>> = {}
  for (const jobResult of jobResultsStore.savedResults) {
    const jobId = jobResult.jobId || ''
    const result = jobResult.results?.result
    if (result && result.building_results) {
      const sumMap: Record<string, number> = {}
      for (const [bid, bres] of Object.entries(result.building_results)) {
        if (bres && typeof bres === 'object' && 'sum' in bres && typeof bres.sum === 'number') {
          sumMap[bid] = bres.sum
        }
      }
      if (Object.keys(sumMap).length > 0 && jobId) {
        maps[jobId] = sumMap
      }
    }
  }
  return maps
})

const discoverAvailableParameters = (): void => {
  const parameters = new Set<string>()
  for (const feature of cjStore.cjFeatures) {
    for (const cityObject of Object.values(feature.CityObjects)) {
      if (cityObject.attributes) {
        for (const [key, value] of Object.entries(cityObject.attributes)) {
          if (typeof value === 'number' && !isNaN(value)) {
            parameters.add(key)
          }
        }
      }
    }
  }

  // Add process sum options
  const processOptions: string[] = []
  for (const jobId of Object.keys(processSumMaps.value)) {
    const suffix = jobId.slice(-4)
    processOptions.push(`Process Sum (${suffix})`)
  }

  // Add additional info parameters
  const additionalInfoParameters = new Set<string>()
  for (const featureInfo of additionalInfoStore.getAllFeaturesInfo) {
    if (featureInfo.properties) {
      for (const [key, value] of Object.entries(featureInfo.properties)) {
        if (typeof value === 'number' && !isNaN(value)) {
          additionalInfoParameters.add(`Additional: ${key}`)
        }
      }
    }
  }

  availableParameters.value = [
    'None',
    ...Array.from(parameters),
    ...processOptions,
    ...Array.from(additionalInfoParameters)
  ]
}

const calculateParameterRange = (parameterName: string): void => {
  let min = Infinity
  let max = -Infinity

  if (parameterName === 'None') {
    currentParameterRange.value = { min: null, max: null }
    return
  }

  // Check if this is a process sum parameter
  const processSumMatch = parameterName.match(/^Process Sum \((\w{4})\)$/)
  if (processSumMatch) {
    // Find the jobId ending with these 4 chars
    const suffix = processSumMatch[1]
    const jobId = Object.keys(processSumMaps.value).find((jid) => jid.endsWith(suffix))
    if (jobId) {
      const sumMap = processSumMaps.value[jobId]
      for (const feature of cjStore.cjFeatures) {
        if (sumMap[feature.id] !== undefined) {
          const value = sumMap[feature.id]
          if (!isNaN(value)) {
            min = Math.min(min, value)
            max = Math.max(max, value)
          }
        }
      }
    }
    currentParameterRange.value =
      min !== Infinity && max !== -Infinity ? { min, max } : { min: 0, max: 100 }
    return
  }

  // Check if this is an additional info parameter
  const additionalInfoMatch = parameterName.match(/^Additional: (.+)$/)
  if (additionalInfoMatch) {
    const propertyName = additionalInfoMatch[1]
    for (const feature of cjStore.cjFeatures) {
      const additionalInfo = additionalInfoStore.getFeatureInfo(feature.id)
      if (additionalInfo?.properties && propertyName in additionalInfo.properties) {
        const value = additionalInfo.properties[propertyName]
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value)
          max = Math.max(max, value)
        }
      }
    }
    currentParameterRange.value =
      min !== Infinity && max !== -Infinity ? { min, max } : { min: 0, max: 100 }
    return
  }

  // Default: attribute
  for (const feature of cjStore.cjFeatures) {
    for (const cityObject of Object.values(feature.CityObjects)) {
      if (cityObject.attributes && parameterName in cityObject.attributes) {
        const value = parseFloat(cityObject.attributes[parameterName])
        if (!isNaN(value)) {
          min = Math.min(min, value)
          max = Math.max(max, value)
        }
      }
    }
  }
  currentParameterRange.value =
    min !== Infinity && max !== -Infinity ? { min, max } : { min: 0, max: 100 }
}

const getParameterColor = (value: number | null): THREE.Color | null => {
  const { min, max } = currentParameterRange.value
  if (
    selectedParameter.value === 'None' ||
    value === null ||
    isNaN(value) ||
    min === null ||
    max === null
  ) {
    return null
  }
  if (min === max) {
    return new THREE.Color().setHSL(0 / 360, 0.8, 0.5)
  }
  const normalizedValue = (value - min) / (max - min)
  const hue = (1 - normalizedValue) * 240
  return new THREE.Color().setHSL(hue / 360, 0.8, 0.5)
}

// Helper to get process sum value for a feature id, if selectedParameter is a process sum
const getProcessSumForFeature = (featureId: string): number | null => {
  const processSumMatch = selectedParameter.value.match(/^Process Sum \((\w{4})\)$/)
  if (processSumMatch) {
    const suffix = processSumMatch[1]
    const jobId = Object.keys(processSumMaps.value).find((jid) => jid.endsWith(suffix))
    if (jobId) {
      const sumMap = processSumMaps.value[jobId]
      if (sumMap && sumMap[featureId] !== undefined) {
        return sumMap[featureId]
      }
    }
  }
  return null
}

// Helper to get additional info value for a feature id, if selectedParameter is an additional info parameter
const getAdditionalInfoForFeature = (featureId: string): number | null => {
  const additionalInfoMatch = selectedParameter.value.match(/^Additional: (.+)$/)
  if (additionalInfoMatch) {
    const propertyName = additionalInfoMatch[1]
    const additionalInfo = additionalInfoStore.getFeatureInfo(featureId)
    if (additionalInfo?.properties && propertyName in additionalInfo.properties) {
      const value = additionalInfo.properties[propertyName]
      if (typeof value === 'number' && !isNaN(value)) {
        return value
      }
    }
  }
  return null
}
const changeMapOperation = (): void => {
  if (!map) return

  if (drawControl) {
    map.removeControl(drawControl)
    drawControl = null
  }
  if (mapStore.activeOperation === null) {
    return
  }

  let modes: TerraDrawMode[] = []
  if (mapStore.activeOperation === 'Pick') {
    modes = ['render', 'polygon', 'circle']
  } else if (mapStore.activeOperation === 'Add') {
    modes = ['render', 'angled-rectangle']
  }

  drawControl = new MaplibreTerradrawControl({ modes, open: true })
  map.addControl(drawControl)
  drawInstance = drawControl.getTerraDrawInstance()

  if (mapStore.activeOperation === 'Pick' && drawInstance) {
    drawInstance.on('finish', (id) => {
      const snapshot = drawInstance!.getSnapshot()
      // The library returns an array of features, so find must handle it
      const polygon = snapshot?.find((feature) => String(feature.id) === String(id)) as
        | TerraDrawFeature
        | undefined
      if (polygon) {
        const coordinates = polygon.geometry.coordinates[0]
        addToSelectionByCoordinateList(coordinates)
      }
    })
  } else if (mapStore.activeOperation === 'Add') {
    drawInstance.on('finish', async (id) => {
      if (!map) return
      const snapshot = drawInstance!.getSnapshot()
      const polygon = snapshot?.find((feature) => String(feature.id) === String(id)) as
        | TerraDrawFeature
        | undefined
      if (!polygon) return
      if (!polygon) return

      let coordinates = polygon.geometry.coordinates[0].slice(0, -1) // last point is same as first
      coordinates = sortCoordinatesByAngle(coordinates as Coordinate[])

      let buildingBaseHeight = 9999
      const utmCoordinatePromises = coordinates.map((coord) =>
        mapStore.transformFromWGS84(coord as [number, number]),
      )
      const utmCoordinates = await Promise.all(utmCoordinatePromises)

      for (let i = 0; i < coordinates.length; i++) {
        const [lng, lat] = coordinates[i]
        const elevation = map.queryTerrainElevation({ lng, lat }) || 0
        if (elevation < buildingBaseHeight) {
          buildingBaseHeight = elevation
        }
      }

      buildingCoordiantes = utmCoordinates.map(([x, y]) => ({ x, y, z: buildingBaseHeight }))

      map.removeControl(drawControl!)
      mapStore.activeOperation = null
      showModal.value = true
    })
  }
}

const addToSelectionByCoordinateList = async (coordinates: number[][]): Promise<void> => {
  const utmCoordinatePromises = coordinates.map((coord) =>
    mapStore.transformFromWGS84(coord as [number, number]),
  )
  const utmPolygon = await Promise.all(utmCoordinatePromises)

  for (const feature of cjStore.cjFeatures) {
    if (feature.id in mSelStore.selFeatures) {
      mSelStore.selFeatures[feature.id] = Object.keys(feature.CityObjects)
      continue
    }

    const cjBase = cjStore.cjBase!
    const transformedVertices = feature.vertices.map(([x, y, z]) => [
      x * cjBase.transform.scale[0] + cjBase.transform.translate[0],
      y * cjBase.transform.scale[1] + cjBase.transform.translate[1],
      z * cjBase.transform.scale[2] + cjBase.transform.translate[2],
    ])

    const isInside = transformedVertices.some((vertex) =>
      pointInPolygon(vertex as [number, number], utmPolygon),
    )
    if (isInside) {
      mSelStore.selFeatures[feature.id] = Object.keys(feature.CityObjects)
    }
  }
}

const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

const forwardClick = (featureId: string, featureElementID: string): void => {
  sSelStore.selFeatID = featureId
  sSelStore.selFeatElemID = featureElementID
  sSelStore.selCounter++
}

const disposeObject = (obj: THREE.Object3D): void => {
  if (!obj) return
  while (obj.children.length > 0) {
    disposeObject(obj.children[0])
  }
  if (obj instanceof THREE.Mesh) {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((material) => material.dispose())
      } else {
        obj.material.dispose()
      }
    }
  }
  obj.parent?.remove(obj)
}

const selectionChanged = (): void => {
  if (!map || !scene) return

  scene.children.forEach((child) => {
    if (child.name.startsWith('obj_') || child.name.startsWith('feature_')) {
      disposeObject(child)
    }
  })

  for (const [featureId, cityObjectIds] of Object.entries(mSelStore.selFeatures)) {
    const feature = cjStore.cjFeatures.find((f) => f.id === featureId)
    if (feature) {
      const featureGroup = featureGroupToThree(feature, cjStore.cjBase!)
      featureGroup.children.forEach((child) => {
        const objId = child.name.split('_')[1]
        if (cityObjectIds.includes(objId)) {
          scene?.add(child.clone())
        }
      })
    }
  }
  map.triggerRepaint()
}

const someFeatureChanged = (): void => {
  if (!map || !scene || !sSelStore.selFeatID) return

  const objName = 'feature_' + sSelStore.selFeatID
  const obj = scene.getObjectByName(objName)

  if (obj) {
    disposeObject(obj)
    scene.updateMatrixWorld(true)

    const newFeature = cjStore.cjFeatures.find((f) => f.id === sSelStore.selFeatID)
    if (newFeature) {
      const newGroup = featureGroupToThree(newFeature, cjStore.cjBase!)
      scene.add(newGroup)
    }
    map.triggerRepaint()
  }
}

const getUniqueColor = ((): (() => THREE.Color) => {
  let hue = 0
  const goldenRatioConjugate = 0.618033988749895
  return () => {
    hue = (hue + goldenRatioConjugate) % 1
    return new THREE.Color().setHSL(hue, 0.5, 0.6)
  }
})()

const calculateOptimalOrigin = (
  mapInstance: Map,
): { origin: [number, number]; needsUpdate: boolean } => {
  const bounds = mapInstance.getBounds()
  const center = mapInstance.getCenter()

  const ne = mapStore.transformFromWGS84([
    bounds.getNorthEast().lng,
    bounds.getNorthEast().lat,
  ])
  const sw = mapStore.transformFromWGS84([
    bounds.getSouthWest().lng,
    bounds.getSouthWest().lat,
  ])
  const centerUTM = mapStore.transformFromWGS84([center.lng, center.lat])

  const viewBounds: [number, number, number, number] = [sw[0], sw[1], ne[0], ne[1]]

  let needsUpdate = false

  if (!currentViewBounds) {
    needsUpdate = true
  } else {
    const distanceFromOrigin = Math.sqrt(
      Math.pow(centerUTM[0] - epsgOrigin![0], 2) + Math.pow(centerUTM[1] - epsgOrigin![1], 2),
    )

    if (distanceFromOrigin > ORIGIN_UPDATE_THRESHOLD) {
      needsUpdate = true
    }
  }

  currentViewBounds = viewBounds
  return {
    origin: [centerUTM[0], centerUTM[1]] as [number, number],
    needsUpdate,
  }
}

const updateSceneOrigin = async (mapInstance: Map, newOrigin: [number, number]): Promise<void> => {
  if (!scene) return

  epsgOrigin = newOrigin

  // recalculate convergence angle for new origin
  const newOriginWGS84 = mapStore.transformToWGS84(newOrigin)
  const zone = Math.floor((newOriginWGS84[0] + 180) / 6) + 1
  const centralMeridian = zone * 6 - 183
  convergenceAngle = Math.atan(
    Math.tan(((newOriginWGS84[0] - centralMeridian) * Math.PI) / 180) *
    Math.sin((newOriginWGS84[1] * Math.PI) / 180),
  )
  rotationMatrix = new THREE.Matrix4().makeRotationZ(-convergenceAngle)

  // update origin height
  originHeight =
    mapInstance.terrain.getElevationForLngLatZoom(
      new maplibregl.LngLat(newOriginWGS84[0], newOriginWGS84[1]),
      mapInstance.transform.tileZoom,
    ) || 0

  // rebuild scene with new origin
  const sceneGroup = scene.getObjectByName('$group')
  if (sceneGroup) {
    const partyWallsExist = sceneGroup.getObjectByName('party_walls') !== undefined
    while (sceneGroup.children.length > 0) {
      disposeObject(sceneGroup.children[0])
    }

    cjStore.cjFeatures.forEach((feature) => {
      sceneGroup.add(featureGroupToThree(feature, cjStore.cjBase!))
    })
    if (partyWallsExist) {

      const results = jobResultsStore.savedResults
      for (const jobResult of results) {
        const realResult = jobResult.results?.result
        if (
          !realResult ||
          (cjStore.currentCollection.id !== realResult.processed_collection &&
            realResult.processed_collection !== 'sent_collection')
        ) {
          continue
        }

        if (realResult.party_walls && Array.isArray(realResult.party_walls)) {
          // create new partyWallGroup
          const partyWallGroup = new THREE.Group()
          for (const partyWall of realResult.party_walls) {
            let boundary: number[][] = partyWall.surface
            if (!boundary || boundary.length < 3) continue

            const wallVertices = new Float32Array(
              boundary.flatMap(([x, y, z]) => {
                const vector = new THREE.Vector3(
                  x - epsgOrigin![0],
                  y - epsgOrigin![1],
                  z - originHeight!,
                )
                vector.applyMatrix4(rotationMatrix!)
                return [vector.x, vector.y, vector.z]
              }),
            )

            const indices = Array.from({ length: boundary.length }, (_, i) => i)
            const triangleIndices = triangulatePolygon(indices, wallVertices)
            if (triangleIndices.length === 0) continue

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(wallVertices, 3))
            geometry.setIndex(triangleIndices)
            geometry.computeVertexNormals()

            const material = new THREE.MeshPhongMaterial({
              color: 0xffff00,
              side: THREE.DoubleSide,
              opacity: 1,
              transparent: false,
            })

            const mesh = new THREE.Mesh(geometry, material)
            partyWallGroup.add(mesh)
          }
          partyWallGroup.name = 'party_walls'
          sceneGroup.add(partyWallGroup)
        }
      }
    }
  }

  lastOriginUpdate = Date.now()
  mapInstance.triggerRepaint()
}

const featureGroupToThree = (feature: CityJSONFeature, cjBase: CityJSONDocument): THREE.Group => {
  const vertices = new Float32Array(
    feature.vertices.flatMap(([x, y, z]) => {
      const vector = new THREE.Vector3(
        x * cjBase.transform.scale[0] + cjBase.transform.translate[0] - epsgOrigin![0],
        y * cjBase.transform.scale[1] + cjBase.transform.translate[1] - epsgOrigin![1],
        z * cjBase.transform.scale[2] + cjBase.transform.translate[2] - originHeight!,
      )
      vector.applyMatrix4(rotationMatrix!)
      return [vector.x, vector.y, vector.z]
    }),
  )

  const featureGroup = new THREE.Group()
  featureGroup.name = 'feature_' + feature.id
  const isFeatureSelected = mSelStore.selFeatures[feature.id] !== undefined

  for (const [id, cityObject] of Object.entries(feature.CityObjects)) {
    const objGroup = new THREE.Group()
    objGroup.name = 'obj_' + id
    const isSelected = isFeatureSelected && mSelStore.selFeatures[feature.id].includes(id)

    // Check if geometry exists and is an array
    if (!cityObject.geometry || !Array.isArray(cityObject.geometry)) {
      console.warn(`CityObject ${id} has invalid geometry:`, cityObject.geometry)
      continue
    }

    // Skip objects with empty geometry arrays
    if (cityObject.geometry.length === 0) {
      // This is normal for parent objects like Building that have child BuildingParts
      continue
    }

    for (const geometry of cityObject.geometry) {
      const geometryGroup = new THREE.Group()
      geometryGroup.name = 'geom_' + geometry.type

      switch (geometry.type) {
        case 'MultiPoint': {
          const pointGeometry = new THREE.BufferGeometry()
          const positions = new Float32Array(
            geometry.boundaries.flatMap((index) => [
              vertices[index * 3],
              vertices[index * 3 + 1],
              vertices[index * 3 + 2],
            ]),
          )
          pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

          const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 5,
            sizeAttenuation: false,
          })

          if (geometry.semantics?.values) {
            const firstValidSemIndex: number | undefined = geometry.semantics.values.find(
              (v: number | null) => v !== null,
            )
            if (
              firstValidSemIndex !== undefined &&
              geometry.semantics.surfaces[firstValidSemIndex]
            ) {
              const [color] = getSemanticColor(geometry.semantics.surfaces[firstValidSemIndex].type)
              material.color = color
            }
          }

          const points = new THREE.Points(pointGeometry, material)
          geometryGroup.add(points)
          break
        }
        case 'MultiLineString': {
          geometry.boundaries.forEach((boundary, lineIndex) => {
            const lineGeometry = new THREE.BufferGeometry()
            const positions = new Float32Array(
              boundary.flatMap((index) => [
                vertices[index * 3],
                vertices[index * 3 + 1],
                vertices[index * 3 + 2],
              ]),
            )
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

            const material = new THREE.LineBasicMaterial({
              color: 0xffffff,
            })

            if (geometry.semantics?.values) {
              const semIndex = geometry.semantics.values[lineIndex]
              if (semIndex !== null && geometry.semantics.surfaces[semIndex]) {
                const [color] = getSemanticColor(geometry.semantics.surfaces[semIndex].type)
                material.color = color
              }
            }

            const line = new THREE.Line(lineGeometry, material)
            geometryGroup.add(line)
          })
          break
        }
        case 'MultiSurface':
        case 'CompositeSurface':
          processSurfaceGeometry(geometry, vertices, geometryGroup, isSelected, cityObject, feature.id)
          break
        case 'Solid':
        case 'MultiSolid':
        case 'CompositeSolid':
          processSolidGeometry(geometry, vertices, geometryGroup, isSelected, cityObject, feature.id)
          break
      }
      objGroup.add(geometryGroup)
    }
    featureGroup.add(objGroup)
  }
  return featureGroup
}

const processSurfaceGeometry = (
  geometry: MultiSurfaceGeom,
  vertices: Float32Array,
  group: THREE.Group,
  isSelected: boolean,
  cityObject: CityObject | null = null,
  featureId?: string,
): void => {
  geometry.boundaries.forEach((surface, surfaceI) => {
    const exteriorRing = surface[0]
    if (!exteriorRing) return

    const semanticInfo: SemanticInfo = {
      hasSemantics: !!geometry.semantics?.values,
      values: geometry.semantics?.values?.[surfaceI],
      surfaces: geometry.semantics?.surfaces,
    }

    const mesh = createGeometryMesh(
      exteriorRing,
      vertices,
      `surface_${surfaceI}`,
      semanticInfo,
      isSelected,
      cityObject,
      featureId,
    )
    if (mesh) group.add(mesh)
  })
}

const processSolidGeometry = (
  geometry: SolidGeom | MultiSolidGeom,
  vertices: Float32Array,
  group: THREE.Group,
  isSelected: boolean,
  cityObject: CityObject | null = null,
  featureId?: string,
): void => {
  const solids: Shell[] =
    geometry.type === 'Solid'
      ? geometry.boundaries // a Solid's boundaries is already a Shell (number[][][])
      : geometry.boundaries.flat() // a MultiSolid's boundaries is Shell[][], so we flatten it to Shell[]
  solids.forEach((shell, solidIndex) => {
    shell.forEach((surface, shellIndex) => {
      const exteriorRing = surface[0]
      if (!exteriorRing) return
      const semanticInfo: SemanticInfo = {
        hasSemantics: !!geometry.semantics?.values,
        values: (geometry.semantics?.values as any)?.[solidIndex]?.[shellIndex],
        surfaces: geometry.semantics?.surfaces,
      }

      const mesh = createGeometryMesh(
        exteriorRing,
        vertices,
        `solid_${solidIndex}_shell_${shellIndex}`,
        semanticInfo,
        isSelected,
        cityObject,
        featureId,
      )

      if (mesh) group.add(mesh)
    })
  })
}

const createGeometryMesh = (
  boundary: number[],
  vertices: Float32Array,
  name: string,
  semanticInfo: SemanticInfo,
  isSelected: boolean,
  cityObject: CityObject | null,
  featureId?: string,
): THREE.Mesh | null => {
  const indices = triangulatePolygon(boundary, vertices)
  if (indices.length === 0) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  let color: THREE.Color = getUniqueColor()
  let opacity: number = semanticColorsStore.defaultOpacity
  let useParameterColoring = false

  // Check for process sum coloring
  if (selectedParameter.value.startsWith('Process Sum')) {
    if (featureId) {
      const sumValue = getProcessSumForFeature(featureId)
      if (sumValue !== null) {
        const paramColor = getParameterColor(sumValue)
        if (paramColor) {
          color = paramColor
          opacity = 0.9
          useParameterColoring = true
        }
      }
    }
  } else if (selectedParameter.value.startsWith('Additional:')) {
    if (featureId) {
      const additionalValue = getAdditionalInfoForFeature(featureId)
      if (additionalValue !== null) {
        const paramColor = getParameterColor(additionalValue)
        if (paramColor) {
          color = paramColor
          opacity = 0.9
          useParameterColoring = true
        }
      }
    }
  } else if (
    selectedParameter.value !== 'None' &&
    cityObject?.attributes?.[selectedParameter.value] !== undefined
  ) {
    const paramValue = cityObject.attributes[selectedParameter.value]
    const paramColor = getParameterColor(typeof paramValue === 'number' ? paramValue : null)
    if (paramColor) {
      color = paramColor
      opacity = 0.9
      useParameterColoring = true
    }
  }

  if (!useParameterColoring) {
    if (
      semanticInfo.hasSemantics &&
      typeof semanticInfo.values === 'number' &&
      semanticInfo.surfaces?.[semanticInfo.values]
    ) {
      ;[color, opacity] = getSemanticColor(semanticInfo.surfaces[semanticInfo.values].type)
    } else {
      ;[color, opacity] = [getUniqueColor(), semanticColorsStore.defaultOpacity]
    }
  }

  const material = new THREE.MeshPhongMaterial({
    color,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
  })

  if (isSelected) {
    material.emissive = new THREE.Color(0xff0000)
    material.emissiveIntensity = 0.3
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  return mesh
}

const triangulatePolygon = (boundary: number[], vertices: Float32Array): number[] => {
  if (boundary.length < 3) return []
  if (boundary.length === 3) return boundary
  if (boundary.length === 4)
    return [boundary[0], boundary[1], boundary[2], boundary[2], boundary[3], boundary[0]]

  const normal = calculateNormal(boundary[0], boundary[1], boundary[2], vertices)
  const points2D = projectTo2D(boundary, vertices, normal)
  const triangles = earcut(points2D)
  return triangles.map((i) => boundary[i])
}

const getSemanticColor = (surfaceType: string): [THREE.Color, number] => {
  const values = semanticColorsStore.getColor(surfaceType)
  if (values) {
    return [new THREE.Color(values.r / 255, values.g / 255, values.b / 255), values.a]
  }
  return [getUniqueColor(), semanticColorsStore.defaultOpacity]
}

const calculateNormal = (
  v1i: number,
  v2i: number,
  v3i: number,
  vertices: Float32Array,
): THREE.Vector3 => {
  const v1 = new THREE.Vector3().fromArray(vertices, v1i * 3)
  const v2 = new THREE.Vector3().fromArray(vertices, v2i * 3)
  const v3 = new THREE.Vector3().fromArray(vertices, v3i * 3)
  return new THREE.Vector3().crossVectors(v2.sub(v1), v3.sub(v1)).normalize()
}

const projectTo2D = (
  boundary: number[],
  vertices: Float32Array,
  normal: THREE.Vector3,
): number[] => {
  const points2D: number[] = []
  const up = new THREE.Vector3(0, 0, 1)
  const axis = new THREE.Vector3().crossVectors(normal, up).normalize()
  const angle = Math.acos(normal.dot(up))
  const rotMatrix = new THREE.Matrix4().makeRotationAxis(axis, angle)

  for (const index of boundary) {
    const point3D = new THREE.Vector3().fromArray(vertices, index * 3)
    const rotatedPoint = point3D.applyMatrix4(rotMatrix)
    points2D.push(rotatedPoint.x, rotatedPoint.y)
  }
  return points2D
}

const setup3DScene = async (): Promise<void> => {
  if (!cjStore.cjBase) return

  let sceneOrigin: LngLat = new maplibregl.LngLat(6.083786, 50.775442)
  try {
    const geoExtent = cjStore.cjBase.metadata?.geographicalExtent
    if (geoExtent) {
      const middle = [(geoExtent[0] + geoExtent[3]) / 2, (geoExtent[1] + geoExtent[4]) / 2]
      const [lng, lat] = await mapStore.transformToWGS84(middle)
      sceneOrigin = new maplibregl.LngLat(lng, lat)
    }
  } catch (error) {
    console.error('Could not determine scene origin from metadata:', error)
  }

  const baseStyle = await (await fetch(mapStore.baseStyleUrl)).json()
  const customStyle = {
    ...baseStyle,
    sources: {
      ...baseStyle.sources,
      terrainSource: {
        type: 'raster-dem',
        url: mapStore.terrainSourceUrl,
        tileSize: 256,
        maxzoom: 15,
      },
    },
    terrain: { source: 'terrainSource', exaggeration: 1 },
  }

  map = new maplibregl.Map({
    container: 'map',
    center: [sceneOrigin.lng, sceneOrigin.lat],
    zoom: 16.27,
    pitch: 30,
    bearing: -28.5,
    antialias: true,
    style: customStyle,
    maxZoom: 20,
    maxPitch: 85,
  })

  map.on('load', () => {
    setupWatchers()
    isInitialized.value = true
  })

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
  )
  map.addControl(new maplibregl.TerrainControl({ source: 'terrainSource', exaggeration: 1 }))

  class LegendControl {
    private _map: Map | undefined
    private _container: HTMLElement

    constructor() {
      this._container = document.createElement('div')
      this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    }

    onAdd(map: Map) {
      this._map = map
      const button = document.createElement('button')
      button.className = 'maplibregl-ctrl-icon flex items-center justify-center px-1 py-0'
      button.innerHTML = '<span class="font-bold text-xs">Vis</span>'
      button.title = 'Toggle Parameter Visualization'
      button.onclick = () => {
        showLegend.value = !showLegend.value
      }
      this._container.appendChild(button)
      return this._container
    }

    onRemove() {
      this._container.parentNode?.removeChild(this._container)
      this._map = undefined
    }
  }
  map.addControl(new LegendControl(), 'top-right')

  class LabelControl {
    private _map: Map | undefined
    private _container: HTMLElement

    constructor() {
      this._container = document.createElement('div')
      this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    }

    onAdd(map: Map) {
      this._map = map
      const button = document.createElement('button')
      button.className = 'maplibregl-ctrl-icon flex items-center justify-center px-1 py-0'
      button.type = 'button'
      button.title = 'Toggle Labels'
      button.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>'
      button.onclick = () => {
        showLabels.value = !showLabels.value
      }
      this._container.appendChild(button)
      return this._container
    }

    onRemove() {
      this._container.parentNode?.removeChild(this._container)
      this._map = undefined
    }
  }
  map.addControl(new LabelControl(), 'top-right')

  const BoxCustomLayer: ThreeJsLayer = {
    id: '3d-building-model',
    type: 'custom',
    renderingMode: '3d',

    camera: new THREE.Camera(),
    scene: new THREE.Scene(),
    renderer: null as THREE.WebGLRenderer | null,
    raycaster: new THREE.Raycaster(),
    customTransform: new THREE.Matrix4(),

    async onAdd(mapInstance: Map, gl: WebGLRenderingContext) {
      this.camera = new THREE.PerspectiveCamera(
        28,
        window.innerWidth / window.innerHeight,
        0.1,
        1e6,
      )

      originHeight =
        mapInstance.terrain.getElevationForLngLatZoom(
          sceneOrigin,
          map?.transform.tileZoom as number,
        ) || 0
      console.log('Origin height:', originHeight)
      epsgOrigin = mapStore.transformFromWGS84([sceneOrigin.lng, sceneOrigin.lat]) as [
        number,
        number,
      ]

      const zone = Math.floor((sceneOrigin.lng + 180) / 6) + 1
      const centralMeridian = zone * 6 - 183
      convergenceAngle = Math.atan(
        Math.tan(((sceneOrigin.lng - centralMeridian) * Math.PI) / 180) *
        Math.sin((sceneOrigin.lat * Math.PI) / 180),
      )
      rotationMatrix = new THREE.Matrix4().makeRotationZ(-convergenceAngle)

      this.customTransform = new THREE.Matrix4()
        .makeRotationX(Math.PI / 2)
        .multiply(new THREE.Matrix4().makeScale(1, 1, -1))
      this.scene = this.makeScene(cjStore.cjBase!, cjStore.cjFeatures)
      scene = this.scene

      this.renderer = new THREE.WebGLRenderer({
        canvas: mapInstance.getCanvas(),
        context: gl,
        antialias: true,
        preserveDrawingBuffer: true,
      })
      this.renderer.autoClear = false
      mapInstance.triggerRepaint()
    },

    makeScene(cjBase: CityJSONDocument, cjFeatures: CityJSONFeature[]): THREE.Scene {
      const scene = new THREE.Scene()
      scene.rotateX(Math.PI / 2)
      scene.scale.multiply(new THREE.Vector3(1, 1, -1))
      scene.add(new THREE.AmbientLight(0xffffff, 0.4))
      scene.add(new THREE.DirectionalLight(0xffffff, 0.8))

      const sceneGroup = new THREE.Group()
      sceneGroup.name = '$group'
      cjFeatures.forEach((feature) => sceneGroup.add(featureGroupToThree(feature, cjBase)))

      const results = jobResultsStore.savedResults
      const partyWallGroup = new THREE.Group()
      partyWallGroup.name = 'party_walls'

      for (const jobResult of results) {
        const realResult = jobResult.results?.result

        if (
          !realResult ||
          (cjStore.currentCollection.id !== realResult.processed_collection &&
            realResult.processed_collection !== 'sent_collection')
        ) {
          continue
        }

        // Check for party_walls property
        if (realResult.party_walls && Array.isArray(realResult.party_walls)) {
          for (const partyWall of realResult.party_walls) {
            // The surface is an array of [x, y, z] coordinates
            let boundary: number[][] = partyWall.surface
            if (!boundary || boundary.length < 3) continue

            const wallVertices = new Float32Array(
              boundary.flatMap(([x, y, z]) => {
                const vector = new THREE.Vector3(
                  x - epsgOrigin![0],
                  y - epsgOrigin![1],
                  z - originHeight!,
                )
                vector.applyMatrix4(rotationMatrix!)
                return [vector.x, vector.y, vector.z]
              }),
            )

            const indices = Array.from({ length: boundary.length }, (_, i) => i)
            const triangleIndices = triangulatePolygon(indices, wallVertices)
            if (triangleIndices.length === 0) continue

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(wallVertices, 3))
            geometry.setIndex(triangleIndices)
            geometry.computeVertexNormals()

            const material = new THREE.MeshPhongMaterial({
              color: 0xff0000,
              side: THREE.DoubleSide,
            })

            const mesh = new THREE.Mesh(geometry, material)
            partyWallGroup.add(mesh)
          }
        }
      }
      sceneGroup.add(partyWallGroup)

      scene.add(sceneGroup)
      return scene
    },

    render(gl: WebGLRenderingContext, matrix) {
      if (!this.renderer) return

      const now = Date.now()
      if (now - lastOriginUpdate > 500) {
        const { origin, needsUpdate } = calculateOptimalOrigin(map!)
        if (needsUpdate) {
          updateSceneOrigin(map!, origin)
          return
        }
      }

      const epsgOriginWGS84 = mapStore.transformToWGS84(epsgOrigin!) as LngLatLike
      const offsetFromCenterElevation = map!.queryTerrainElevation(epsgOriginWGS84) || 0
      const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(
        mapStore.transformToWGS84(epsgOrigin!) as LngLatLike,
        offsetFromCenterElevation,
      )

      const sceneTransform = {
        translateX: sceneOriginMercator.x,
        translateY: sceneOriginMercator.y,
        translateZ: sceneOriginMercator.z,
        scale: sceneOriginMercator.meterInMercatorCoordinateUnits(),
      }

      const projectionMatrix = new THREE.Matrix4().fromArray(matrix)
      const mercatorMatrix = new THREE.Matrix4()
        .makeTranslation(
          sceneTransform.translateX,
          sceneTransform.translateY,
          sceneTransform.translateZ,
        )
        .scale(new THREE.Vector3(sceneTransform.scale, -sceneTransform.scale, sceneTransform.scale))

      this.camera.projectionMatrix = projectionMatrix
        .multiply(mercatorMatrix)
        .multiply(this.customTransform)

      this.renderer.resetState()
      if (!mapStore.showMap) {
        this.renderer.clear(true, true, true)
      }
      this.renderer.render(this.scene, this.camera)
    },

    raycast(point: { x: number; y: number }, isClick?: boolean) {
      const mouse = new THREE.Vector2(
        (point.x / map!.transform.width) * 2 - 1,
        1 - (point.y / map!.transform.height) * 2,
      )
      const camInverseProjection = new THREE.Matrix4().copy(this.camera.projectionMatrix).invert()
      const cameraPosition = new THREE.Vector3().applyMatrix4(camInverseProjection)
      const mousePosition = new THREE.Vector3(mouse.x, mouse.y, 1).applyMatrix4(
        camInverseProjection,
      )
      const viewDirection = mousePosition.clone().sub(cameraPosition).normalize()

      this.raycaster.set(cameraPosition, viewDirection)
      const intersects = this.raycaster.intersectObjects(this.scene.children, true)

      if (intersects.length > 0) {
        let obj = intersects[0].object
        while (obj.parent && !obj.name.startsWith('obj_')) {
          obj = obj.parent
        }
        if (obj.name.startsWith('obj_')) {
          forwardClick(obj.parent!.name.split('_')[1], obj.name.split('_')[1])
        }
      }
    },
  }

  map.once('idle', () => map!.addLayer(BoxCustomLayer as CustomLayerInterface))
  map.on('click', (e) => {
    if (mapStore.activeOperation === null && BoxCustomLayer.raycast) {
      BoxCustomLayer.raycast(e.point, true)
    }
  })

  mapCameraManager = new MapCameraManager(map)
}

class MapCameraManager {
  map: Map
  params: Record<string, number> = {}

  constructor(mapInstance: Map) {
    this.map = mapInstance
    this.init()
    this.map.on('moveend', () => this.updateURLParameters())
  }

  init(): void {
    const urlParams = new URLSearchParams(window.location.search)
    const cameraPosition = localStorage.getItem('cameraPosition')
    if (cameraPosition) {
      try {
        const parsed = JSON.parse(cameraPosition)
        if (parsed.lng && parsed.lat && parsed.zoom) {
          mapStore.hasSavedCamera = true
        }
      } catch (e) {
        console.error('Error parsing saved camera position:', e)
        localStorage.removeItem('cameraPosition')
      }
    }

    const lng = parseFloat(urlParams.get('lng') || '')
    const lat = parseFloat(urlParams.get('lat') || '')
    const zoom = parseFloat(urlParams.get('zoom') || '')
    const bearing = parseFloat(urlParams.get('bearing') || '')
    const pitch = parseFloat(urlParams.get('pitch') || '')

    if (!isNaN(lng) && !isNaN(lat) && !isNaN(zoom)) {
      const newParams = {
        lng,
        lat,
        zoom,
        bearing: isNaN(bearing) ? 0 : bearing,
        pitch: isNaN(pitch) ? 0 : pitch,
      }
      this.jumpTo(newParams)
    } else {
      this.setParamsFromMap()
      this.checkIfCurrPosIsSavedPos()
    }
  }

  jumpTo(params: Record<string, number>): void {
    this.params = { ...params }
    this.map.jumpTo({
      center: [params['lng'], params['lat']],
      zoom: params['zoom'],
      bearing: params['bearing'],
      pitch: params['pitch'],
    })
    this.checkIfCurrPosIsSavedPos()
  }

  setParamsFromMap(): void {
    const center = this.map.getCenter()
    this.params['lng'] = center.lng
    this.params['lat'] = center.lat
    this.params['zoom'] = this.map.getZoom()
    this.params['bearing'] = this.map.getBearing()
    this.params['pitch'] = this.map.getPitch()
  }

  updateURLParameters(): void {
    this.setParamsFromMap()
    const params = new URLSearchParams()
    params.set('lng', this.params['lng'].toFixed(6))
    params.set('lat', this.params['lat'].toFixed(6))
    params.set('zoom', this.params['zoom'].toFixed(2))
    params.set('bearing', this.params['bearing'].toFixed(2))
    params.set('pitch', this.params['pitch'].toFixed(2))

    const newURL = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newURL)
    this.checkIfCurrPosIsSavedPos()
  }

  saveParams(): void {
    localStorage.setItem('cameraPosition', JSON.stringify(this.params))
    mapStore.hasSavedCamera = true
    mapStore.currEqSaved = true
  }

  loadParams(): void {
    const cameraPosition = localStorage.getItem('cameraPosition')
    if (cameraPosition) {
      try {
        const parsedParams = JSON.parse(cameraPosition)
        this.jumpTo(parsedParams)
      } catch (e) {
        console.error('Error parsing saved camera position:', e)
      }
    }
  }

  checkIfCurrPosIsSavedPos(): void {
    const cameraPosition = localStorage.getItem('cameraPosition')
    if (cameraPosition) {
      if (JSON.stringify(this.params) === cameraPosition) {
        mapStore.currEqSaved = true
        return
      }
    }
    mapStore.currEqSaved = false
  }
}

const cleanupWatchers = (): void => {
  Object.values(watchers).forEach((watcher) => watcher?.())
  Object.keys(watchers).forEach((key) => {
    watchers[key] = null
  })
}

const setupWatchers = (): void => {
  if (!map || !isMounted.value) return
  cleanupWatchers()

  watchers.selFeatures = watch(() => mSelStore.selFeatures, selectionChanged, { deep: true })
  watchers.cjFeatures = watch(() => cjStore.cjFeatures, someFeatureChanged, { deep: true })
  watchers.activeOperation = watch(() => mapStore.activeOperation, changeMapOperation)
  watchers.saveCamera = watch(
    () => mapStore.saveCamera,
    () => mapCameraManager?.saveParams(),
  )
  watchers.loadCamera = watch(
    () => mapStore.loadCamera,
    () => mapCameraManager?.loadParams(),
  )

  watchers.showMap = watch(
    () => mapStore.showMap,
    () => {
      if (!isMounted.value || !isInitialized.value) return
      try {
        map?.triggerRepaint()
      } catch (error) {
        console.error('Error triggering repaint:', error)
      }
    },
  )

  watchers.jumpTargetLamp = watch(
    () => mapStore.jumpTargetLamp,
    async () => {
      if (!isMounted.value || !isInitialized.value) return
      if (mapCameraManager === null || mapStore.jumpTarget === null) return
      try {
        let [lng, lat] = mapStore.transformToWGS84([mapStore.jumpTarget[0], mapStore.jumpTarget[1]])
        mapCameraManager.jumpTo({
          lng,
          lat,
          zoom: 18,
          bearing: mapCameraManager.params.bearing,
          pitch: mapCameraManager.params.pitch,
        })
      } catch (error) {
        console.error('Error jumping to target:', error)
      }
    },
  )

  watchers.pictureLamp = watch(
    () => mapStore.pictureLamp,
    () => {
      if (!isMounted.value || !isInitialized.value) return
      if (map === null) return

      map.once('idle', () => {
        if (!isMounted.value || !isInitialized.value) return
        try {
          const canvas = map!.getCanvas()
          const dataURL = canvas.toDataURL('image/png')
          const a = document.createElement('a')
          a.href = dataURL
          a.download = `map_${cjStore.currentCollection.id}.png`
          a.click()
        } catch (error) {
          console.error('Error taking picture:', error)
        }
      })
      try {
        map.triggerRepaint()
      } catch (error) {
        console.error('Error triggering repaint:', error)
      }
    },
  )

  watchers.selectedParameter = watch(
    () => selectedParameter.value,
    (newParameter) => {
      if (!isInitialized.value || !scene) return
      calculateParameterRange(newParameter)
      const sceneGroup = scene.getObjectByName('$group')
      if (sceneGroup) {
        while (sceneGroup.children.length > 0) {
          disposeObject(sceneGroup.children[0])
        }
        cjStore.cjFeatures.forEach((feature) => {
          sceneGroup.add(featureGroupToThree(feature, cjStore.cjBase!))
        })
      }
      map?.triggerRepaint()
    },
  )

  watchers.showLabels = watch(
    () => showLabels.value,
    (isVisible) => {
      const visibility = isVisible ? 'visible' : 'none'
      const style = map?.getStyle()
      style?.layers.forEach((layer) => {
        if (layer.type === 'symbol') {
          map?.setLayoutProperty(layer.id, 'visibility', visibility)
        }
      })
    },
    { immediate: true },
  )

  // Watch for changes in additional info to update available parameters
  watch(
    () => additionalInfoStore.featuresInfo.size,
    () => {
      if (isInitialized.value && cjStore.cjFeatures.length > 0) {
        discoverAvailableParameters()
      }
    },
    { immediate: false }
  )
}

onMounted(async () => {
  isMounted.value = true
  const unwatch = watch(
    () => cjStore.isLoaded,
    async (isLoaded) => {
      if (isLoaded && isMounted.value) {
        await setup3DScene()
        discoverAvailableParameters()
        unwatch()
      }
    },
    { immediate: true },
  )
})

onUnmounted(() => {
  isMounted.value = false
  isInitialized.value = false
  cleanupWatchers()
  if (scene) {
    scene.traverse(disposeObject)
    scene = null
  }
  map?.remove()
  map = null
  mapCameraManager = null
})

const handleSubmit = (): void => {
  if (!isFormValid.value) return
  const { id, buildingHeight, roofType, roofHeight, roofOrientation } = params.value
  showModal.value = false
  const newFeature = createFeatureWithGeometry(
    cjStore.cjBase!,
    id,
    uuidv5(id, NAMESPACE),
    buildingCoordiantes,
    buildingHeight,
    roofType as RoofType,
    roofHeight,
    Number(roofOrientation),
  )
  cjStore.cjFeatures.push(newFeature)
  const newGroup = featureGroupToThree(newFeature, cjStore.cjBase!)
  scene?.add(newGroup)
  forwardClick(id, id)
  params.value = { id: '', buildingHeight: 0, roofType: '', roofHeight: 0, roofOrientation: 0 }
}

const isFormValid: ComputedRef<boolean> = computed(() => {
  const { id, buildingHeight, roofType, roofHeight } = params.value
  if (!id || !buildingHeight || !roofType) return false
  if (cjStore.cjFeatures.some((f) => f.id === id)) return false
  if (buildingHeight < 0) return false
  if (showRoofHeight.value && roofHeight <= 0) return false
  if (roofHeight >= buildingHeight) return false
  return true
})

const showRoofHeight: ComputedRef<boolean> = computed(
  () => params.value.roofType !== '1000' && params.value.roofType !== '',
)
const showRoofOrientation: ComputedRef<boolean> = computed(() =>
  ['1010', '1020', '1030'].includes(params.value.roofType),
)
</script>

<template>
  <Modal v-model="showModal" title="Enter building parameters">
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700">Building id</label>
        <input v-model="params.id" type="text"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Building height</label>
        <input v-model="params.buildingHeight" type="number"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700">Roof type</label>
        <select v-model="params.roofType"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          <option value="">Select an option</option>
          <option value="1000">Flat roof</option>
          <option value="1010">Monopitch roof</option>
          <option value="1020">Dualpent roof</option>
          <option value="1030">Gabled roof</option>
          <option value="1040">Hipped roof</option>
          <option value="1070">Pavilion roof</option>
        </select>
      </div>

      <div v-if="showRoofHeight">
        <label class="block text-sm font-medium text-gray-700">Roof height</label>
        <input v-model="params.roofHeight" type="number"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        <p class="mt-1 text-sm text-gray-500">
          Difference from the heighest to the lowest point of the roof
        </p>
      </div>

      <div v-if="showRoofOrientation">
        <label class="block text-sm font-medium text-gray-700">Roof orientation</label>
        <select v-model="params.roofOrientation"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          <option value="0">North</option>
          <option value="1">East</option>
          <option value="2">South</option>
          <option value="3">West</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">Steepest roof surface direction</p>
      </div>
    </div>

    <template #footer>
      <button @click="showModal = false" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
        Cancel
      </button>
      <button @click="handleSubmit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        :disabled="!isFormValid" :class="{ 'opacity-50 cursor-not-allowed': !isFormValid }">
        Submit
      </button>
    </template>
  </Modal>
  <div id="map"></div>
  <div v-if="showLegend"
    class="absolute bottom-8 right-8 bg-white bg-opacity-90 p-5 rounded-lg shadow-xl z-10 w-80 flex flex-col gap-4">
    <div class="flex justify-between items-start">
      <div>
        <h3 class="text-lg font-semibold m-0">Visualize Parameter</h3>
        <p class="text-sm text-gray-500">Color buildings by a numeric attribute.</p>
      </div>
      <button @click="showLegend = false"
        class="bg-transparent border-0 cursor-pointer text-2xl leading-none -mt-1 -mr-1">
        ×
      </button>
    </div>

    <select v-model="selectedParameter"
      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
      <option v-for="param in availableParameters" :key="param" :value="param">
        {{ param }}
      </option>
    </select>

    <!-- gradient and values -->
    <div v-if="selectedParameter !== 'None' && currentParameterRange.min !== null">
      <div class="h-6 w-full rounded-md mt-2 mb-2 legend-gradient"></div>
      <div class="flex justify-between text-sm font-medium">
        <span>{{ Number(currentParameterRange.min.toPrecision(3)) }}</span>
        <span>{{ Number(currentParameterRange.max?.toPrecision(3)) }}</span>
      </div>
      <div class="text-right text-sm text-gray-600 mt-1">{{ selectedParameter }}</div>
    </div>
  </div>
</template>

<style>
@import 'maplibre-gl/dist/maplibre-gl.css';
@import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';

#map {
  height: 100%;
}

.legend-gradient {
  background: linear-gradient(to right,
      hsl(240, 80%, 50%),
      hsl(180, 80%, 50%),
      hsl(120, 80%, 50%),
      hsl(60, 80%, 50%),
      hsl(0, 80%, 50%));
}
</style>
