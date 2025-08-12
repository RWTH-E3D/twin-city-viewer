import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Ref } from 'vue'
import proj4 from 'proj4'
import type { RGBAColor, MapSettings, SemanticColorsState } from '@/types/map'

const SEMANTIC_COLORS_KEY = 'semantic-colors-settings'
const MAP_SETTINGS_KEY = 'map-settings'

const DEFAULT_MAP_SETTINGS: MapSettings = {
  baseStyleUrl: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
  terrainSourceUrl: 'https://web3d.basemap.de/maplibre/terrain-tiles.json',
}

const loadSavedSettings = <T>(key: string, defaultSettings: T): T => {
  try {
    const savedSettings = localStorage.getItem(key)
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      if (parsed && typeof parsed === 'object') {
        return { ...defaultSettings, ...parsed }
      }
    }
  } catch (error: unknown) {
    console.error(`Error loading saved settings for ${key}:`, error)
  }
  return structuredClone(defaultSettings)
}

export const useMapStore = defineStore('mapSettings', () => {
  const activeOperation: Ref<'Pick' | 'Add' | null> = ref(null)
  const canSwitchOperation = ref<boolean>(true)
  const saveCamera = ref<boolean>(false)
  const hasSavedCamera = ref<boolean>(false)
  const loadCamera = ref<boolean>(false)
  const currEqSaved = ref<boolean>(false)
  const jumpTarget = ref<[number, number] | null>(null)
  const jumpTargetLamp = ref<boolean>(false)
  const pictureLamp = ref<boolean>(false)
  const showMap = ref<boolean>(true)
  const currentCRS = ref<string>('EPSG:4326')
  const transformationLoading = ref<boolean>(false)
  const lastError: Ref<string | null> = ref(null)

  const savedMapSettings = loadSavedSettings<MapSettings>(MAP_SETTINGS_KEY, DEFAULT_MAP_SETTINGS)
  const baseStyleUrl = ref<string>(savedMapSettings.baseStyleUrl)
  const terrainSourceUrl = ref<string>(savedMapSettings.terrainSourceUrl)

  const updateBaseStyle = (url: string): void => {
    baseStyleUrl.value = url
    saveMapSettings()
  }

  const updateTerrainSource = (url: string): void => {
    terrainSourceUrl.value = url
    saveMapSettings()
  }

  const resetMapSettings = (): void => {
    baseStyleUrl.value = DEFAULT_MAP_SETTINGS.baseStyleUrl
    terrainSourceUrl.value = DEFAULT_MAP_SETTINGS.terrainSourceUrl
    saveMapSettings()
  }

  const saveMapSettings = (): void => {
    try {
      const settings: MapSettings = {
        baseStyleUrl: baseStyleUrl.value,
        terrainSourceUrl: terrainSourceUrl.value,
      }
      localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify(settings))
    } catch (error: unknown) {
      console.error('Error saving map settings:', error)
    }
  }

  const transformCoordinates = (coords: number[], fromEPSG: string, toEPSG: string): number[] => {
    transformationLoading.value = true
    lastError.value = null
    try {
      const fromCode = fromEPSG.replace('EPSG:', '')
      const toCode = toEPSG.replace('EPSG:', '')

      const fromProjection = getProjectionDefinition(fromCode)
      const toProjection = getProjectionDefinition(toCode)

      if (!fromProjection || !toProjection) {
        throw new Error(`Could not find definition for EPSG:${!fromProjection ? fromCode : toCode}`)
      }

      const result = proj4(fromProjection, toProjection, coords)

      if (!result || result.length < 2) throw new Error('Transformation failed')

      return [result[0], result[1]]
    } catch (error: unknown) {
      lastError.value = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      transformationLoading.value = false
    }
  }

  const getProjectionDefinition = (epsgCode: string): string | null => {
    const projectionDefs: Record<string, string> = {
      '4326': '+proj=longlat +datum=WGS84 +no_defs',
      '3857':
        '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
      '7415':
        '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +vunits=m +no_defs +type=crs',
      '5555': '+proj=utm +zone=32 +ellps=GRS80 +units=m +vunits=m +no_defs +type=crs',
    }
    return projectionDefs[epsgCode] || null
  }

  const transformToWGS84 = (
    coords: number[] | [number, number],
    fromEPSG?: string | null,
  ): number[] => {
    const sourceCRS = fromEPSG || currentCRS.value
    if (!sourceCRS) throw new Error('No source CRS specified')
    return transformCoordinates(coords, sourceCRS, 'EPSG:4326')
  }

  const transformFromWGS84 = (coords: number[], toEPSG?: string | null): number[] => {
    const targetCRS = toEPSG || currentCRS.value
    if (!targetCRS) throw new Error('No target CRS specified')
    return transformCoordinates(coords, 'EPSG:4326', targetCRS)
  }

  const setCurrentCRS = (epsgCode: string): void => {
    currentCRS.value = epsgCode.includes('EPSG:') ? epsgCode : `EPSG:${epsgCode}`
  }

  return {
    activeOperation,
    canSwitchOperation,
    saveCamera,
    hasSavedCamera,
    loadCamera,
    currEqSaved,
    jumpTarget,
    jumpTargetLamp,
    pictureLamp,
    showMap,
    currentCRS,
    transformationLoading,
    lastError,
    baseStyleUrl,
    terrainSourceUrl,
    updateBaseStyle,
    updateTerrainSource,
    resetMapSettings,
    saveMapSettings,
    transformCoordinates,
    transformToWGS84,
    transformFromWGS84,
    setCurrentCRS,
  }
})

const DEFAULT_COLORS: Record<string, RGBAColor> = {
  WallSurface: { r: 255, g: 255, b: 255, a: 1 },
  RoofSurface: { r: 255, g: 0, b: 0, a: 1 },
  GroundSurface: { r: 51, g: 51, b: 51, a: 1 },
  Window: { r: 77, g: 179, b: 255, a: 1 },
  Door: { r: 153, g: 77, b: 0, a: 1 },
  ClosureSurface: { r: 128, g: 128, b: 128, a: 1 },
}

export const useSemanticColorsStore = defineStore('semanticColors', {
  state: (): SemanticColorsState =>
    loadSavedSettings<SemanticColorsState>(SEMANTIC_COLORS_KEY, {
      semanticSurfaces: structuredClone(DEFAULT_COLORS),
      defaultOpacity: 1,
    }),
  getters: {
    getColor:
      (state: SemanticColorsState) =>
      (surfaceType: string): RGBAColor | undefined => {
        const color = state.semanticSurfaces[surfaceType]
        if (!color) return undefined
        return { ...color, a: color.a * state.defaultOpacity }
      },
    surfaceTypes: (state: SemanticColorsState): string[] => {
      return Object.keys(state.semanticSurfaces)
    },
  },
  actions: {
    updateColor(surfaceType: string, color: RGBAColor): void {
      if (this.semanticSurfaces[surfaceType]) {
        this.semanticSurfaces[surfaceType] = {
          r: Math.round(color.r),
          g: Math.round(color.g),
          b: Math.round(color.b),
          a: parseFloat(color.a.toString()),
        }
        this.saveSettings()
      }
    },
    setDefaultOpacity(opacity: number): void {
      this.defaultOpacity = opacity
      this.saveSettings()
    },
    addSurface(surfaceType: string, color: RGBAColor = { r: 255, g: 255, b: 255, a: 1 }): void {
      this.semanticSurfaces[surfaceType] = color
      this.saveSettings()
    },
    removeSurface(surfaceType: string): void {
      delete this.semanticSurfaces[surfaceType]
      this.saveSettings()
    },
    resetToDefault(): void {
      this.semanticSurfaces = structuredClone(DEFAULT_COLORS)
      this.defaultOpacity = 1
      this.saveSettings()
    },
    saveSettings(): void {
      try {
        localStorage.setItem(
          SEMANTIC_COLORS_KEY,
          JSON.stringify({
            semanticSurfaces: this.semanticSurfaces,
            defaultOpacity: this.defaultOpacity,
          }),
        )
      } catch (error: unknown) {
        console.error('Error saving semantic colors settings:', error)
      }
    },
  },
})
