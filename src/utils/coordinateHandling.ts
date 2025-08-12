export type Coordinate = [number, number]

/**
 * Sorts coordinates based on their angle relative to a center point.
 * @param {Coordinate[]} coordinates - Array of [longitude, latitude] pairs
 * @returns {Coordinate[]} Sorted coordinates
 */
export function sortCoordinatesByAngle(coordinates: Coordinate[]): Coordinate[] {
  if (coordinates.length < 2) return coordinates

  const center = coordinates
    .reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0])
    .map((sum) => sum / coordinates.length) as Coordinate

  // calculate angles for each point relative to center
  const withAngles = coordinates.map((coord) => {
    const dx = coord[0] - center[0]
    const dy = coord[1] - center[1]

    // calculate angle in degrees (0° is east, 90° is north)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI)
    angle = (angle + 360) % 360 // convert to 0-360 range
    angle = (450 - angle) % 360 // adjust so 0° is north

    return {
      coord,
      angle,
      sortValue: angle >= 270 ? angle - 270 : angle + 90,
    }
  })

  // sort based on adjusted angles and return just the coordinates
  return withAngles.sort((a, b) => a.sortValue - b.sortValue).map((item) => item.coord)
}
