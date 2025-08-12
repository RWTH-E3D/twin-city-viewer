<template>
  <div class="flex flex-col h-full flex-1 overflow-hidden">
    <div class="flex z-10 bg-gray-300 p-2">
      <h5 class="">ID: {{ cityObjectID }}</h5>
      <div class="flex-1"></div>
      <button @click="closeFct" class="bg-red-500 hover:bg-red-700 text-white font-bold px-1.5 rounded">
        X
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-2 text-sm">
      <div class="flex justify-between items-center">
        <button @click="handleSelection" class="bg-blue-500 hover:bg-blue-700 text-white font-bold px-2 rounded">
          {{ isSelected ? 'Deselect' : 'Select' }}
        </button>
        <button v-if="isMapRoute" @click="jumpTo"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold px-2 rounded truncate">
          Jump to
        </button>
        <button @click="deleteObject" class="bg-red-500 hover:bg-red-700 text-white font-bold px-2 rounded">
          Delete
        </button>
      </div>
      <div>Feature ID: {{ props.featureID }}</div>
      <h5>Type: {{ cityObject.type }}</h5>

      <!-- Address Section -->
      <div v-if="cityObject.address && cityObject.address.length > 0" class="mt-2">
        <h5>Address:</h5>
        <div v-for="(addr, index) in cityObject.address" :key="index" class="pl-2 grid gap-1">
          <template v-for="(value, key) in addr" :key="key">
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <span class="truncate" :title="String(key)">{{ key }}:</span>
              <input type="text" v-model="addr[key]" class="rounded px-1 min-w-0" />
            </div>
          </template>
        </div>
      </div>

      <h5 v-if="cityObject.attributes">Attributes:</h5>
      <div class="grid gap-2 max-w-full">
        <!-- Existing attributes -->
        <template v-if="cityObject.attributes">
          <div v-for="(value, name) in cityObject.attributes" :key="name"
            class="grid grid-cols-[120px_1fr_auto] gap-2 items-center">
            <span class="ps-2 truncate" :title="name">{{ name }}: </span>
            <input type="text" :value="value"
              @input="cityObject.attributes[name] = ($event.target as HTMLInputElement).value"
              class="rounded px-1 min-w-0" />
            <button @click="removeAttribute(name as string)" class="text-red-500 rounded hover:bg-slate-200 px-2">
              ×
            </button>
          </div>
        </template>
        <!-- Add new attribute -->
        <div class="grid grid-cols-[120px_1fr_auto] gap-2 items-center">
          <input type="text" v-model="newAttributeName" placeholder="Name" class="border rounded px-1 min-w-0" />
          <input type="text" v-model="newAttributeValue" placeholder="Value" class="border rounded px-1 min-w-0" />
          <button @click="addAttribute" class="text-green-500 rounded hover:bg-slate-200 px-2">
            +
          </button>
        </div>
      </div>

      <!-- Transform Controls -->
      <div class="mt-2">
        <button @click="showTransformControls = !showTransformControls"
          class="mb-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium flex items-center gap-2">
          <span>{{ showTransformControls ? 'Hide' : 'Show' }} Transform Controls</span>
          <span class="text-xs">{{ showTransformControls ? '▼' : '▶' }}</span>
        </button>
        <div v-show="showTransformControls" class="bg-gray-100 p-3 rounded mb-4">
          <h6 class="font-bold mb-2">Transform Controls</h6>
          <div class="grid grid-cols-2 gap-4">
            <!-- Position Controls -->
            <div>
              <label class="block text-sm font-medium mb-1">Position offset</label>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="text-xs">X</label>
                  <input type="number" v-model.number="position.x" @input="updateTransform"
                    class="w-full rounded px-1" />
                </div>
                <div>
                  <label class="text-xs">Y</label>
                  <input type="number" v-model.number="position.y" @input="updateTransform"
                    class="w-full rounded px-1" />
                </div>
                <div>
                  <label class="text-xs">Z</label>
                  <input type="number" v-model.number="position.z" @input="updateTransform"
                    class="w-full rounded px-1" />
                </div>
              </div>
            </div>
            <!-- Rotation Control -->
            <div>
              <label class="block text-sm font-medium mb-1">Rotation offset (°)</label>
              <div>
                <label class="text-xs">Z-axis</label>
                <input type="number" v-model.number="rotationZ" @input="updateTransform" class="w-full rounded px-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CityObjectCoor :cityObject="cityObject" :translatedVerts="translatedVerts" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'

import CityObjectCoor from './CityObjectGeom.vue'

import { multiSelStore } from '@/stores/selectionStore'
import { useMapStore } from '@/stores/mapStore'

import type { CityObject, CityJSONDocument } from '@/types/cityjson'
import type { Vertices } from '@/types/cityjson'

const route = useRoute()
const mSelStore = multiSelStore()
const mapStore = useMapStore()

const props = defineProps<{
  cityObject: CityObject
  featureID: string
  cityObjectID: string
  featVert: Vertices
  cjBase: CityJSONDocument
  closeFct: () => void
}>()

const emit = defineEmits<{
  (e: 'update:featVert', vertices: Vertices): void
  (e: 'delete'): void
}>()

const position = ref({ x: 0, y: 0, z: 0 })
const rotationZ = ref(0)
const centerPoint = ref<[number, number, number]>([0, 0, 0])
const originalVerts = ref<number[][]>([])
const translatedVerts = ref<number[][]>([])
const showTransformControls = ref(false)
const newAttributeName = ref('')
const newAttributeValue = ref('')

const isMapRoute = computed(() => route.path === '/')

const addAttribute = (): void => {
  if (!newAttributeName.value.trim()) return
  if (!props.cityObject.attributes) {
    props.cityObject.attributes = {}
  }
  props.cityObject.attributes[newAttributeName.value] = newAttributeValue.value
  newAttributeName.value = ''
  newAttributeValue.value = ''
}

const removeAttribute = (name: string): void => {
  if (props.cityObject.attributes) {
    delete props.cityObject.attributes[name]
  }
}

const calculateBounds = (): { center: [number, number, number] } => {
  if (!translatedVerts.value.length) return { center: [0, 0, 0] }
  const bounds = { min: [...translatedVerts.value[0]], max: [...translatedVerts.value[0]] }
  for (const vertex of translatedVerts.value) {
    for (let j = 0; j < 3; j++) {
      bounds.min[j] = Math.min(bounds.min[j], vertex[j])
      bounds.max[j] = Math.max(bounds.max[j], vertex[j])
    }
  }
  const center: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ]
  centerPoint.value = center
  return { center }
}

const calculateTranslatedVerts = (): void => {
  const newTranslated: number[][] = []
  const newOriginal: number[][] = []
  for (const vert of props.featVert) {
    const translatedVert = [
      vert[0] * props.cjBase.transform.scale[0] + props.cjBase.transform.translate[0],
      vert[1] * props.cjBase.transform.scale[1] + props.cjBase.transform.translate[1],
      vert[2] * props.cjBase.transform.scale[2] + props.cjBase.transform.translate[2],
    ]
    newTranslated.push(translatedVert)
    newOriginal.push([...translatedVert])
  }
  translatedVerts.value = newTranslated
  originalVerts.value = newOriginal
  calculateBounds()
}

const updateTransform = (): void => {
  const verts = originalVerts.value.map((vert) => {
    let x = vert[0] - centerPoint.value[0]
    let y = vert[1] - centerPoint.value[1]
    let z = vert[2] - centerPoint.value[2]
    const rad = (rotationZ.value * Math.PI) / 180
    const rotX = x * Math.cos(rad) - y * Math.sin(rad)
    const rotY = x * Math.sin(rad) + y * Math.cos(rad)
    return [
      rotX + centerPoint.value[0] + position.value.x,
      rotY + centerPoint.value[1] + position.value.y,
      z + centerPoint.value[2] + position.value.z,
    ]
  })
  translatedVerts.value = verts
  const untranslated: Vertices = verts.map((v) => [
    (v[0] - props.cjBase.transform.translate[0]) / props.cjBase.transform.scale[0],
    (v[1] - props.cjBase.transform.translate[1]) / props.cjBase.transform.scale[1],
    (v[2] - props.cjBase.transform.translate[2]) / props.cjBase.transform.scale[2],
  ])
  emit('update:featVert', untranslated)
}

const isSelected = computed<boolean>(() => {
  return mSelStore.selFeatures[props.featureID]?.includes(props.cityObjectID) ?? false
})

const handleSelection = (): void => {
  if (!mSelStore.selFeatures[props.featureID]) {
    mSelStore.selFeatures[props.featureID] = []
  }
  const objectIds = mSelStore.selFeatures[props.featureID]
  const index = objectIds.indexOf(props.cityObjectID)
  if (index === -1) {
    objectIds.push(props.cityObjectID)
  } else {
    objectIds.splice(index, 1)
    if (objectIds.length === 0) {
      delete mSelStore.selFeatures[props.featureID]
    }
  }
}

const deleteObject = (): void => emit('delete')
const jumpTo = (): void => {
  const center3D = calculateBounds().center
  mapStore.jumpTarget = [center3D[0], center3D[1]]
  mapStore.jumpTargetLamp = !mapStore.jumpTargetLamp
}

watch([() => props.featVert, () => props.cjBase], calculateTranslatedVerts, {
  deep: true,
  immediate: true,
})
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  appearance: none;
  -moz-appearance: textfield;
}
</style>
