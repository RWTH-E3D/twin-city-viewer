import type { WatchStopHandle } from 'vue'
import type { RoofType } from './cityjson'
import type { Camera, Scene, WebGLRenderer, Raycaster, Matrix4 } from 'three'
import type { CustomLayerInterface, CustomRenderMethod } from 'maplibre-gl'

export interface BuildingFormParams {
  id: string
  buildingHeight: number
  roofType: RoofType | ''
  roofHeight: number
  roofOrientation: number
}

export interface MapWatchers {
  [key: string]: WatchStopHandle | null
}

export interface SemanticInfo {
  hasSemantics: boolean
  values: number | (number | null)[] | null | undefined
  surfaces: { type: string }[] | undefined
}

export interface TerraDrawFeature {
  id: FeatureId
  type: 'Feature'
  properties: Record<string, any>
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface ThreeJsLayer extends CustomLayerInterface {
  camera: Camera
  scene: Scene
  renderer: WebGLRenderer | null
  raycaster: Raycaster
  customTransform: Matrix4
  render: CustomRenderMethod
  makeScene: (cjBase: any, cjFeatures: any) => Scene
  raycast?: (point: { x: number; y: number }, isClick?: boolean) => void
}

export interface TerraDrawInstance {
  on(event: 'finish', callback: (id: FeatureId) => void): void

  getSnapshot(): TerraDrawFeature[]
}

export type TerraDrawMode =
  | 'delete'
  | 'render'
  | 'select'
  | 'circle'
  | 'polygon'
  | 'angled-rectangle'
  | 'point'
  | 'linestring'
  | 'rectangle'
  | 'freehand'
  | 'sensor'
  | 'sector'
  | 'delete-selection'

export type FeatureId = string | number | undefined
