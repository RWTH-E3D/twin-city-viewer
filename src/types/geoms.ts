export type Ring = number[]
export type Surface = Ring[] // number[][]
export type Shell = Surface[] // number[][][]

interface BaseGeometry {
  lod: string
  semantics?: {
    surfaces: { type: string; id?: string }[]
    values: any
  }
  vertices?: number[][]
}

export interface MultiPointGeom extends BaseGeometry {
  type: 'MultiPoint'
  boundaries: number[]
  semantics?: BaseGeometry['semantics'] & {
    values: (number | null)[]
  }
}

export interface MultiLineStringGeom extends BaseGeometry {
  type: 'MultiLineString'
  boundaries: number[][]
  semantics?: BaseGeometry['semantics'] & {
    values: (number | null)[]
  }
}

export interface MultiSurfaceGeom extends BaseGeometry {
  type: 'MultiSurface' | 'CompositeSurface'
  boundaries: Surface[]
  semantics?: BaseGeometry['semantics'] & {
    values: (number | null)[]
  }
}

export interface SolidGeom extends BaseGeometry {
  type: 'Solid'
  boundaries: Shell[]
  semantics?: BaseGeometry['semantics'] & {
    values: (number | null)[][]
  }
}

export interface MultiSolidGeom extends BaseGeometry {
  type: 'MultiSolid' | 'CompositeSolid'
  boundaries: Shell[][]
  semantics?: BaseGeometry['semantics'] & {
    values: (number | null)[][][]
  }
}

export type CityJSONGeometry =
  | MultiPointGeom
  | MultiLineStringGeom
  | MultiSurfaceGeom
  | SolidGeom
  | MultiSolidGeom
