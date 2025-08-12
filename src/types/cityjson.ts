import type { CityJSONGeometry } from './geoms'

export type Vertices = number[][]

export interface Address {
  [key: string]: string
}

export interface CityObject {
  type: string
  attributes?: Record<string, any>
  address?: Address[]
  geometry: CityJSONGeometry[]
  [key: string]: any
}

export interface CityJSONFeature {
  id: string
  uuid?: string
  type: string
  CityObjects: Record<string, CityObject>
  vertices: Vertices
}

export interface CityJSONDocument {
  type: 'CityJSON'
  version: string
  transform: {
    scale: [number, number, number]
    translate: [number, number, number]
  }
  metadata?: {
    referenceSystem: string
    geographicalExtent?: number[]
    [key: string]: any
  }
  [key: string]: any
}

export interface LoadDataOptions {
  limit?: number
  offset?: number
  queryParams?: string
  cjStore: any
  onSuccess?: (collectionId: string) => void
  onError?: (error: any) => void
}

export interface ApiLink {
  rel: string
  href: string
  type: string
  title?: string
}

export interface ApiCollection {
  id: string
  title: string
  description: string
  itemType: string
  links: ApiLink[]
  numOfItems?: number
  storageCrs?: string
  extent?: {
    spatial?: {
      bbox: number[][]
      crs: string
    }
    temporal?: {
      interval: (string | null)[][]
    }
  }
}

export interface CollectionExtent {
  spatial: {
    bbox: number[][] | null
    crs: string | null
  }
  temporal: {
    interval: (string | null)[][] | null
  }
}

export interface CollectionState {
  id: string | null
  title: string | null
  description: string | null
  itemType: string | null
  numOfItems: number
  extent: CollectionExtent
  apiUrl: string | null
  limit: number
  offset: number
}

export interface LocalCollection {
  id: string
  title: string
  description: string
  itemType: string
  extent: {
    spatial: {
      bbox: number[] | null
      crs: string | null
    }
    temporal: {
      interval: null
    }
  }
}

export type RoofType = '1000' | '1010' | '1020' | '1030' | '1040' | '1070'
