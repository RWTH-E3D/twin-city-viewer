import type proj4 from 'proj4'
import { getConverter, isWgs84 } from './crs'


const EARTH_RADIUS = 6371008.8
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS
const DEG_TO_RAD = Math.PI / 180

/** Identical to MapLibre's internal `mercatorXfromLng`. */
export const mercatorXfromLng = (lng: number): number => (180 + lng) / 360

/** Identical to MapLibre's internal `mercatorYfromLat`. */
export const mercatorYfromLat = (lat: number): number =>
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360

/** Identical to `MercatorCoordinate.meterInMercatorCoordinateUnits()` at `lat`. */
export const mercatorUnitsPerMeter = (lat: number): number =>
  1 / (EARTH_CIRCUMFERENCE * Math.cos(lat * DEG_TO_RAD))

export class SceneAnchor {
  readonly lng: number
  readonly lat: number
  readonly mercX: number
  readonly mercY: number
  readonly scale: number
  private readonly metersPerMercatorUnit: number

  constructor(lng: number, lat: number) {
    this.lng = lng
    this.lat = lat
    this.mercX = mercatorXfromLng(lng)
    this.mercY = mercatorYfromLat(lat)
    this.scale = mercatorUnitsPerMeter(lat)
    this.metersPerMercatorUnit = 1 / this.scale
  }

  /** WGS84 lng/lat/altitude -> scene units. */
  fromLngLat(lng: number, lat: number, altitude: number, out: number[] = [0, 0, 0]): number[] {
    out[0] = (mercatorXfromLng(lng) - this.mercX) * this.metersPerMercatorUnit
    out[1] = -(mercatorYfromLat(lat) - this.mercY) * this.metersPerMercatorUnit
    out[2] = altitude
    return out
  }

  /** Scene units -> WGS84 lng/lat. Inverse of `fromLngLat`, altitude untouched. */
  toLngLat(x: number, y: number): [number, number] {
    const mercX = this.mercX + x * this.scale
    const mercY = this.mercY - y * this.scale
    const lng = mercX * 360 - 180
    const y2 = 180 - mercY * 360
    const lat = (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
    return [lng, lat]
  }
}

export class SceneProjector {
  readonly anchor: SceneAnchor
  readonly sourceCRS: string
  private readonly toWgs84: proj4.Converter | null
  private readonly scratch: [number, number] = [0, 0]

  constructor(anchor: SceneAnchor, sourceCRS: string) {
    this.anchor = anchor
    this.sourceCRS = sourceCRS
    this.toWgs84 = isWgs84(sourceCRS) ? null : getConverter(sourceCRS, 'EPSG:4326')
  }

  project(x: number, y: number, z: number, out: number[] = [0, 0, 0]): number[] {
    if (this.toWgs84 === null) return this.anchor.fromLngLat(x, y, z, out)
    this.scratch[0] = x
    this.scratch[1] = y
    const [lng, lat] = this.toWgs84.forward(this.scratch) as [number, number]
    return this.anchor.fromLngLat(lng, lat, z, out)
  }

  projectCityJsonVertices(
    vertices: number[][],
    scale: [number, number, number] | number[],
    translate: [number, number, number] | number[],
  ): Float32Array {
    const out = new Float32Array(vertices.length * 3)
    const scratch: number[] = [0, 0, 0]
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      this.project(
        v[0] * scale[0] + translate[0],
        v[1] * scale[1] + translate[1],
        v[2] * scale[2] + translate[2],
        scratch,
      )
      out[i * 3] = scratch[0]
      out[i * 3 + 1] = scratch[1]
      out[i * 3 + 2] = scratch[2]
    }
    return out
  }

  projectRing(ring: number[][]): Float32Array {
    const out = new Float32Array(ring.length * 3)
    const scratch: number[] = [0, 0, 0]
    for (let i = 0; i < ring.length; i++) {
      this.project(ring[i][0], ring[i][1], ring[i][2], scratch)
      out[i * 3] = scratch[0]
      out[i * 3 + 1] = scratch[1]
      out[i * 3 + 2] = scratch[2]
    }
    return out
  }
}
