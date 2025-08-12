<template>
  <div v-for="(geometry, geoIndex) in cityObject.geometry as CityJSONGeometry[]" :key="geoIndex" class="ps-2">
    <div>Type: {{ geometry.type }}</div>
    <div>LoD: {{ geometry.lod }}</div>

    <!-- SEMANTIC SECTION -->
    <div v-if="geometry.semantics" class="mb-4">
      <h6 class="font-bold">Semantic Surfaces:</h6>

      <!-- MultiSurface -->
      <template v-if="geometry.type === 'MultiSurface' || geometry.type === 'CompositeSurface'">
        <div v-for="(surface, surfaceIndex) in geometry.boundaries as Surface[]" :key="surfaceIndex">
          <hr class="mt-2" />
          <div class="ps-2">
            <template v-if="geometry.semantics?.values">
              <span v-if="typeof (geometry.semantics.values as any[])[surfaceIndex] === 'number'">
                {{
                  geometry.semantics.surfaces[(geometry.semantics.values as number[])[surfaceIndex]]
                    ?.type
                }}
              </span>
              <span v-else>No Semantics</span>
            </template>
          </div>
          <div v-for="(ring, ringIndex) in surface" :key="ringIndex">
            <vertex-table :boundaries="ring" :translated-verts="translatedVerts" />
          </div>
        </div>
      </template>

      <!-- Solid -->
      <template v-if="geometry.type === 'Solid'">
        <div v-for="(shell, shellIndex) in geometry.boundaries as Shell[]" :key="shellIndex">
          <div v-for="(surface, surfaceIndex) in shell" :key="surfaceIndex">
            <hr class="mt-2" />
            <div class="ps-2">{{ getSurfaceInfo(geometry, shellIndex, surfaceIndex) }}</div>
            <div v-for="(ring, ringIndex) in surface" :key="ringIndex">
              <vertex-table :boundaries="ring" :translated-verts="translatedVerts" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- NON-SEMANTIC SECTION -->
    <div v-else class="mb-4">
      <template v-if="geometry.type === 'Solid'">
        <div v-for="(shell, shellIndex) in geometry.boundaries as Shell[]" :key="shellIndex">
          <!-- `shell` is a Surface[], which is a Ring[][] -->
          <div v-for="(surface, surfaceIndex) in shell" :key="surfaceIndex">
            <!-- `surface` is a Surface, which is a Ring[] -->
            <div v-for="(ring, ringIndex) in surface" :key="ringIndex">
              <!-- `ring` is a Ring, which is a number[] -->
              <vertex-table :boundaries="ring" :translated-verts="translatedVerts" />
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="geometry.type === 'MultiSurface' || geometry.type === 'CompositeSurface'">
        <div v-for="(surface, index) in geometry.boundaries as Surface[]" :key="index">
          <div v-for="(ring, ringIndex) in surface" :key="ringIndex">
            <!-- Here, `ring` is the ring (number[]) -->
            <vertex-table :boundaries="ring" :translated-verts="translatedVerts" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import VertexTable from './VertexTable.vue'
import type { CityObject } from '@/types/cityjson'
import type { CityJSONGeometry, SolidGeom, Surface, Shell } from '@/types/geoms'

const props = defineProps<{
  cityObject: CityObject
  translatedVerts: number[][]
}>()

const getSurfaceInfo = (
  geometry: SolidGeom,
  shellIndex: number,
  surfaceIndex: number,
): string => {
  if (!geometry.semantics?.values) return 'No Semantics'

  const semanticValue = (geometry.semantics.values as (number | null)[][])[shellIndex]?.[
    surfaceIndex
  ]

  if (semanticValue === null || semanticValue === undefined) return 'No Semantics'

  const surface = geometry.semantics.surfaces[semanticValue]
  if (!surface) return 'Unknown type'

  let info = surface.type
  if ('id' in surface && surface.id) {
    info += ` (ID: ${surface.id})`
  }
  return info
}
</script>
