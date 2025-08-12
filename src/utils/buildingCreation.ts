import type { CityJSONDocument, CityJSONFeature, RoofType } from '@/types/cityjson'
import type { SolidGeom, CityJSONGeometry } from '@/types/geoms'

export type namedPoint3D = { x: number; y: number; z: number }

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

function centerPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): { x: number; y: number } {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
}

export function createBuildingGeometry(
  cornerPoints: namedPoint3D[],
  height: number,
  roofType: RoofType,
  roofHeight = 0,
  roofOrientation = 0,
): SolidGeom {
  if (cornerPoints.length !== 4 || !height || !roofType) {
    throw new Error('Invalid input parameters')
  }

  if (roofType !== '1000' && (roofOrientation < 0 || roofOrientation > 3)) {
    throw new Error('Roof orientation must be between 0 and 3')
  }

  const wallHeight = roofType === '1000' ? height : height - roofHeight
  const baseHeight = cornerPoints[0].z

  let vertices: namedPoint3D[] = [...cornerPoints]
  let shell: number[][][] = []
  let values: (number | null)[][] = []
  let center0: { x: number; y: number }
  let center1: { x: number; y: number }

  switch (roofType) {
    case '1000': // Flat roof
      vertices.push(...cornerPoints.map((p) => ({ x: p.x, y: p.y, z: baseHeight + height })))
      shell = [
        [[0, 1, 2, 3]],
        [[0, 4, 5, 1]],
        [[1, 5, 6, 2]],
        [[2, 6, 7, 3]],
        [[3, 7, 4, 0]],
        [[4, 7, 6, 5]],
      ]
      break

    case '1010': // Monopitch roof
      for (let i = 0; i < 4; i++) {
        const h = i === roofOrientation || i === (roofOrientation + 1) % 4 ? wallHeight : height
        vertices.push({ x: cornerPoints[i].x, y: cornerPoints[i].y, z: baseHeight + h })
      }
      shell = [
        [[0, 1, 2, 3]],
        [[0, 4, 5, 1]],
        [[1, 5, 6, 2]],
        [[2, 6, 7, 3]],
        [[3, 7, 4, 0]],
        [[4, 7, 6, 5]],
      ]
      break

    case '1020': // Dualpent roof
      for (let i = 0; i < 4; i++) {
        vertices.push({ x: cornerPoints[i].x, y: cornerPoints[i].y, z: baseHeight + wallHeight })
      }
      const middleHeight = baseHeight + height - roofHeight / 3
      if (roofOrientation % 2 === 0) {
        center0 = centerPoint(cornerPoints[1], cornerPoints[2])
        center1 = centerPoint(cornerPoints[3], cornerPoints[0])
        vertices.push(
          { x: center0.x, y: center0.y, z: middleHeight },
          { x: center0.x, y: center0.y, z: baseHeight + height },
          { x: center1.x, y: center1.y, z: middleHeight },
          { x: center1.x, y: center1.y, z: baseHeight + height },
        )
        if (roofOrientation === 0) {
          shell = [
            [[0, 1, 2, 3]],
            [[0, 4, 5, 1]],
            [[1, 5, 9, 8, 6, 2]],
            [[2, 6, 7, 3]],
            [[3, 7, 10, 11, 4, 0]],
            [[8, 9, 11, 10]],
            [[4, 11, 9, 5]],
            [[6, 8, 10, 7]],
          ]
        } else {
          shell = [
            [[0, 1, 2, 3]],
            [[0, 4, 5, 1]],
            [[1, 5, 8, 9, 6, 2]],
            [[2, 6, 7, 3]],
            [[3, 7, 11, 10, 4, 0]],
            [[10, 11, 9, 8]],
            [[4, 10, 8, 5]],
            [[6, 9, 11, 7]],
          ]
        }
      } else {
        // roofOrientation % 2 === 1
        center0 = centerPoint(cornerPoints[2], cornerPoints[3])
        center1 = centerPoint(cornerPoints[0], cornerPoints[1])
        vertices.push(
          { x: center0.x, y: center0.y, z: middleHeight },
          { x: center0.x, y: center0.y, z: baseHeight + height },
          { x: center1.x, y: center1.y, z: middleHeight },
          { x: center1.x, y: center1.y, z: baseHeight + height },
        )
        if (roofOrientation === 1) {
          shell = [
            [[0, 1, 2, 3]],
            [[0, 4, 10, 11, 5, 1]],
            [[1, 5, 6, 2]],
            [[2, 6, 9, 8, 7, 3]],
            [[3, 7, 4, 0]],
            [[8, 9, 11, 10]],
            [[7, 8, 10, 4]],
            [[5, 11, 9, 6]],
          ]
        } else {
          shell = [
            [[0, 1, 2, 3]],
            [[0, 4, 11, 10, 5, 1]],
            [[1, 5, 6, 2]],
            [[2, 6, 8, 9, 7, 3]],
            [[3, 7, 4, 0]],
            [[10, 11, 9, 8]],
            [[7, 9, 11, 4]],
            [[5, 10, 8, 6]],
          ]
        }
      }
      break

    case '1030': // Gabled roof
      for (let i = 0; i < 4; i++) {
        vertices.push({ x: cornerPoints[i].x, y: cornerPoints[i].y, z: baseHeight + wallHeight })
      }
      if (roofOrientation % 2 === 0) {
        center0 = centerPoint(cornerPoints[1], cornerPoints[2])
        center1 = centerPoint(cornerPoints[0], cornerPoints[3])
        shell = [
          [[0, 1, 2, 3]],
          [[0, 4, 5, 1]],
          [[1, 5, 8, 6, 2]],
          [[2, 6, 7, 3]],
          [[3, 7, 9, 4, 0]],
          [[4, 9, 8, 5]],
          [[6, 8, 9, 7]],
        ]
      } else {
        center0 = centerPoint(cornerPoints[0], cornerPoints[1])
        center1 = centerPoint(cornerPoints[2], cornerPoints[3])
        shell = [
          [[0, 1, 2, 3]],
          [[0, 1, 5, 8, 4]],
          [[1, 2, 6, 5]],
          [[2, 3, 7, 9, 6]],
          [[3, 0, 4, 7]],
          [[4, 8, 9, 7]],
          [[5, 6, 9, 8]],
        ]
      }
      vertices.push(
        { x: center0.x, y: center0.y, z: baseHeight + height },
        { x: center1.x, y: center1.y, z: baseHeight + height },
      )
      break

    case '1040': // Hipped roof
      for (let i = 0; i < 4; i++) {
        vertices.push({ x: cornerPoints[i].x, y: cornerPoints[i].y, z: baseHeight + wallHeight })
      }
      const lengthA = distance(cornerPoints[0], cornerPoints[1])
      const lengthB = distance(cornerPoints[1], cornerPoints[2])
      const ridgeRunsParallelToSideA = lengthA >= lengthB
      const longSide = Math.max(lengthA, lengthB)
      const shortSide = Math.min(lengthA, lengthB)
      const ridgeLength = longSide - shortSide
      const ridgeHalfLength = ridgeLength / 2
      let ridgeCenter: { x: number; y: number }
      let ridgeVector: { x: number; y: number }

      if (ridgeRunsParallelToSideA) {
        ridgeCenter = centerPoint(
          centerPoint(cornerPoints[0], cornerPoints[3]),
          centerPoint(cornerPoints[1], cornerPoints[2]),
        )
        const vector = {
          x: cornerPoints[1].x - cornerPoints[0].x,
          y: cornerPoints[1].y - cornerPoints[0].y,
        }
        const vectorLength = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
        ridgeVector = { x: vector.x / vectorLength, y: vector.y / vectorLength }
      } else {
        ridgeCenter = centerPoint(
          centerPoint(cornerPoints[0], cornerPoints[1]),
          centerPoint(cornerPoints[2], cornerPoints[3]),
        )
        const vector = {
          x: cornerPoints[2].x - cornerPoints[1].x,
          y: cornerPoints[2].y - cornerPoints[1].y,
        }
        const vectorLength = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
        ridgeVector = { x: vector.x / vectorLength, y: vector.y / vectorLength }
      }
      const ridgeStart = {
        x: ridgeCenter.x - ridgeVector.x * ridgeHalfLength,
        y: ridgeCenter.y - ridgeVector.y * ridgeHalfLength,
        z: baseHeight + height,
      }
      const ridgeEnd = {
        x: ridgeCenter.x + ridgeVector.x * ridgeHalfLength,
        y: ridgeCenter.y + ridgeVector.y * ridgeHalfLength,
        z: baseHeight + height,
      }
      vertices.push(ridgeStart, ridgeEnd)
      shell = [
        [[0, 1, 2, 3]],
        [[0, 4, 5, 1]],
        [[1, 5, 6, 2]],
        [[2, 6, 7, 3]],
        [[3, 7, 4, 0]],
        [[4, 8, 5]],
        [[5, 8, 9, 6]],
        [[6, 9, 7]],
        [[7, 9, 8, 4]],
      ]
      break

    case '1070': // Pavilion roof
      for (let i = 0; i < 4; i++) {
        vertices.push({ x: cornerPoints[i].x, y: cornerPoints[i].y, z: baseHeight + wallHeight })
      }
      center0 = centerPoint(cornerPoints[0], cornerPoints[2])
      vertices.push({ x: center0.x, y: center0.y, z: baseHeight + height })
      shell = [
        [[0, 1, 2, 3]],
        [[0, 4, 5, 1]],
        [[1, 5, 6, 2]],
        [[2, 6, 7, 3]],
        [[3, 7, 4, 0]],
        [[4, 5, 8]],
        [[5, 6, 8]],
        [[6, 7, 8]],
        [[7, 4, 8]],
      ]
      break
  }

  const surfaces = [{ type: 'GroundSurface' }, { type: 'WallSurface' }, { type: 'RoofSurface' }]

  if (roofType === '1000' || roofType === '1010') {
    values = [[0, 1, 1, 1, 1, 2]]
  } else if (roofType === '1020') {
    values = [[0, 1, 1, 1, 1, 1, 2, 2]]
  } else if (roofType === '1030') {
    values = [[0, 1, 1, 1, 1, 2, 2]]
  } else if (roofType === '1040' || roofType === '1070') {
    values = [[0, 1, 1, 1, 1, 2, 2, 2, 2]]
  }

  const vertexArray = vertices.map((v) => [
    Math.round(v.x * 1000) / 1000,
    Math.round(v.y * 1000) / 1000,
    Math.round(v.z * 1000) / 1000,
  ])

  return {
    type: 'Solid',
    lod: '2',
    boundaries: [shell],
    semantics: { surfaces, values },
    vertices: vertexArray,
  }
}

export function createFeatureWithGeometry(
  cjBase: CityJSONDocument,
  id: string,
  uuid: string,
  cornerPoints: namedPoint3D[],
  height: number,
  roofType: RoofType,
  roofHeight = 0,
  roofOrientation = 0,
): CityJSONFeature {
  const geometryWithVertices = createBuildingGeometry(
    cornerPoints,
    height,
    roofType,
    roofHeight,
    roofOrientation,
  )

  const transformedVertices = (geometryWithVertices.vertices || []).map((v) => [
    (v[0] - cjBase.transform.translate[0]) / cjBase.transform.scale[0],
    (v[1] - cjBase.transform.translate[1]) / cjBase.transform.scale[1],
    (v[2] - cjBase.transform.translate[2]) / cjBase.transform.scale[2],
  ])

  const { vertices, ...geometryWithoutVertices } = geometryWithVertices

  return {
    type: 'CityJSONFeature',
    id: id,
    uuid: uuid,
    CityObjects: {
      [id]: {
        type: 'Building',
        attributes: { roofType, measuredHeight: height },
        geometry: [geometryWithoutVertices as CityJSONGeometry],
      },
    },
    vertices: transformedVertices,
  }
}
