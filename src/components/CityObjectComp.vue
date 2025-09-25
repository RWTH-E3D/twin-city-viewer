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

      <!-- Geometry Section -->
      <div class="mt-2">
        <button @click="showGeometry = !showGeometry"
          class="mb-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium flex items-center gap-2">
          <span>{{ showGeometry ? 'Hide' : 'Show' }} Geometry</span>
          <span class="text-xs">{{ showGeometry ? '▼' : '▶' }}</span>
        </button>
        <div v-show="showGeometry">
          <CityObjectCoor :cityObject="cityObject" :translatedVerts="translatedVerts" />
        </div>
      </div>

      <!-- Process Results Section -->
      <div v-if="processResultsForObject.length" class="mt-4">
        <h5 class="mb-2">Process Results</h5>
        <div v-for="proc in processResultsForObject" :key="proc.jobId" class="mb-2 p-2 bg-gray-50 rounded">
          <div class="flex items-center gap-2">
            <span class="font-semibold">Process {{ proc.jobId.slice(-4) }}</span>
            <span class="text-xs text-gray-500">Sum: {{ proc.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })
            }}</span>
            <label class="ml-2 text-xs flex items-center gap-1">
              <input type="checkbox" v-model="proc.visible" /> Show in graph
            </label>
          </div>
        </div>
        <div v-if="anyProcessVisible" class="mt-4">
          <div style="width:100%; max-height:40vh;">
            <LineChart :chart-data="chartData" :chart-options="chartOptions" style="width:100%; height:40vh;" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-ignore
// @ts-ignore
import { Line } from 'vue-chartjs'
// @ts-ignore
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import { defineComponent, h } from 'vue'
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale)
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'

import CityObjectCoor from './CityObjectGeom.vue'


import { multiSelStore } from '@/stores/selectionStore'
import { useMapStore } from '@/stores/mapStore'
import { useJobResultsStore } from '@/stores/jobResultsStore'

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
const jobResultsStore = useJobResultsStore()

// --- Process Results for this object ---
interface ProcResultLine {
  jobId: string
  sum: number
  raw_values: number[]
  visible: boolean
}

const processResultsForObject = ref<ProcResultLine[]>([])

// On mount or when jobResultsStore.savedResults or cityObjectID changes, update processResultsForObject
watch(
  [() => jobResultsStore.savedResults, () => props.cityObjectID],
  () => {
    const results: ProcResultLine[] = []
    for (const jobResult of jobResultsStore.savedResults) {
      const jobId = jobResult.jobId || ''
      const proc = jobResult.results?.result
      if (proc && proc.building_results && proc.building_results[props.cityObjectID]) {
        const bres = proc.building_results[props.cityObjectID]
        if (bres && typeof bres === 'object' && Array.isArray(bres.raw_values) && typeof bres.sum === 'number') {
          results.push({
            jobId,
            sum: bres.sum,
            raw_values: bres.raw_values,
            visible: true,
          })
        }
      }
    }
    processResultsForObject.value = results
  },
  { immediate: true, deep: true }
)



// Chart.js integration
const colors = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#f59e42', // orange-400
  '#dc2626', // red-600
  '#7c3aed', // purple-600
  '#eab308', // yellow-500
  '#0ea5e9', // sky-500
  '#f43f5e', // pink-500
]

// Month labels for 365 days (approximate, not leap year aware)
const monthLabels = (() => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  // Days per month (non-leap year)
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let labels: string[] = []
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= daysPerMonth[m]; d++) {
      labels.push(months[m])
    }
  }
  return labels.slice(0, 365)
})()

const anyProcessVisible = computed(() => processResultsForObject.value.some(p => p.visible))

const chartData = computed(() => {
  const datasets = processResultsForObject.value
    .filter(p => p.visible)
    .map((p, i) => ({
      label: `Proc ${p.jobId.slice(-4)}`,
      data: p.raw_values.slice(0, 365),
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '33',
      fill: false,
      tension: 0.2,
      pointRadius: 0,
    }))
  return {
    labels: monthLabels,
    datasets,
  }
})


const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true },
    title: { display: true, text: 'Daily Values' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      title: { display: true, text: 'Month' },
      ticks: {
        callback: function (value: number, index: number, values: any) {
          // Only show month label at the first day of each month
          if (index === 0) return 'Jan'
          const monthStartDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const found = monthStartDays.indexOf(index)
          if (found !== -1) return monthNames[found]
          return ''
        },
        maxRotation: 0,
        minRotation: 0,
        autoSkip: false,
        font: { size: 12 },
      },
    },
    y: { title: { display: true, text: 'Heating Load' } },
  },
}

// Chart component
const LineChart = defineComponent({
  name: 'LineChart',
  props: {
    chartData: Object as () => any,
    chartOptions: Object as () => any
  },
  components: { Line },
  setup(props) {
    return () => props.chartData && props.chartOptions
      ? h(Line, { data: props.chartData as any, options: props.chartOptions as any })
      : null
  },
})

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
const showGeometry = ref(false)
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
