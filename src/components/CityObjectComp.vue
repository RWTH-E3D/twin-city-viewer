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

      <!-- Additional Information Section -->
      <div v-if="additionalInfo" class="mt-4 border-t-2 border-blue-200 pt-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          <h5 class="font-semibold text-blue-800">Additional Information</h5>
          <span class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">External Data Source</span>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div class="grid gap-2 max-w-full">
            <template v-if="additionalInfo.properties">
              <div v-for="(value, name) in additionalInfo.properties" :key="name"
                class="grid grid-cols-[120px_1fr_auto] gap-2 items-center">
                <span class="text-sm font-medium text-blue-800 truncate" :title="String(name)">{{ name }}:</span>
                <input type="text" :value="value"
                  @input="updateAdditionalProperty(String(name), ($event.target as HTMLInputElement).value)"
                  class="text-sm text-blue-700 bg-white px-2 py-1 rounded border focus:border-blue-500 focus:ring-blue-500 min-w-0" />
                <button @click="removeAdditionalProperty(String(name))"
                  class="text-red-500 rounded hover:bg-blue-100 px-2">
                  ×
                </button>
              </div>
            </template>
            <div v-if="!additionalInfo.properties || Object.keys(additionalInfo.properties).length === 0"
              class="text-sm text-blue-600 italic">
              No additional properties available
            </div>
            <!-- Add new additional property -->
            <div class="grid grid-cols-[120px_1fr_auto] gap-2 items-center border-t border-blue-200 pt-2 mt-2">
              <input type="text" v-model="newAdditionalPropertyName" placeholder="Name"
                class="text-sm border rounded px-2 py-1 min-w-0 focus:border-blue-500 focus:ring-blue-500" />
              <input type="text" v-model="newAdditionalPropertyValue" placeholder="Value"
                class="text-sm border rounded px-2 py-1 min-w-0 focus:border-blue-500 focus:ring-blue-500" />
              <button @click="addAdditionalProperty" class="text-green-500 rounded hover:bg-blue-100 px-2">
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Additional Information Message -->
      <div v-else-if="additionalInfoStore.isLoaded && additionalInfoStore.connectedCollection"
        class="mt-4 border-t-2 border-gray-200 pt-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-3 h-3 bg-gray-400 rounded-full"></div>
          <h5 class="font-semibold text-gray-600">Additional Information</h5>
          <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">External Data Source</span>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div class="text-sm text-gray-600 italic">
            No additional information found for this feature ID: {{ props.featureID }}
          </div>
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
            <span class="font-semibold">Process: {{ proc.jobId.slice(-9) }}</span>
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
import { useAdditionalInfoStore } from '@/stores/additionalInfoStore'

import type { CityObject, CityJSONDocument } from '@/types/cityjson'
import type { Vertices } from '@/types/cityjson'

const route = useRoute()
const mSelStore = multiSelStore()
const mapStore = useMapStore()
const additionalInfoStore = useAdditionalInfoStore()


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
  timeInfo?: {
    startTime: number
    stopTime: number
    intervals: number
    isHeatLoad: boolean
  }
}

const processResultsForObject = ref<ProcResultLine[]>([])

// On mount or when jobResultsStore.savedResults or cityObjectID changes, update processResultsForObject
watch(
  [() => jobResultsStore.savedResults, () => props.cityObjectID, () => props.featureID],
  () => {
    const results: ProcResultLine[] = []
    for (const jobResult of jobResultsStore.savedResults) {
      const jobId = jobResult.jobId || ''

      // Handle regular process results (existing logic)
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

      // Handle json-build-and-simulate heat load results
      if (jobResult.processId === 'json-build-and-simulate' && jobResult.results?.heat_loads) {
        const heatLoads = jobResult.results.heat_loads
        if (heatLoads[props.featureID]) {
          const heatLoadData = heatLoads[props.featureID]
          if (heatLoadData.heat_load_series && typeof heatLoadData.heat_load_sum === 'number') {
            results.push({
              jobId: jobId + '_heat',
              sum: heatLoadData.heat_load_sum,
              raw_values: heatLoadData.heat_load_series,
              visible: true,
              timeInfo: {
                startTime: heatLoadData.start_time || 0,
                stopTime: heatLoadData.stop_time || 86400,
                intervals: heatLoadData.intervals || 1440,
                isHeatLoad: true
              }
            })
          }
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

const generateTimeLabels = (timeInfo: ProcResultLine['timeInfo'], dataLength: number): string[] => {
  if (!timeInfo) {
    // Default to month labels for legacy data (365 days)
    return monthLabels.slice(0, dataLength)
  }

  const { startTime, stopTime, intervals } = timeInfo
  const totalDuration = Math.abs(stopTime - startTime) // in seconds
  const timeStep = totalDuration / intervals // seconds per interval

  const labels: string[] = []

  // Determine appropriate label format based on time step
  if (timeStep >= 86400) {
    // Daily or longer intervals
    for (let i = 0; i < dataLength; i++) {
      const days = Math.floor(i * timeStep / 86400)
      labels.push(`Day ${days + 1}`)
    }
  } else if (timeStep >= 3600) {
    // Hourly intervals
    for (let i = 0; i < dataLength; i++) {
      const hours = Math.floor(i * timeStep / 3600)
      const day = Math.floor(hours / 24) + 1
      const hour = hours % 24
      labels.push(`D${day} ${hour.toString().padStart(2, '0')}:00`)
    }
  } else {
    // Sub-hourly intervals
    for (let i = 0; i < dataLength; i++) {
      const totalMinutes = Math.floor(i * timeStep / 60)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const day = Math.floor(hours / 24) + 1
      const hourOfDay = hours % 24
      labels.push(`D${day} ${hourOfDay.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
    }
  }

  return labels
}

const anyProcessVisible = computed(() => processResultsForObject.value.some(p => p.visible))

const chartData = computed(() => {
  const visibleResults = processResultsForObject.value.filter(p => p.visible)

  if (visibleResults.length === 0) {
    return { labels: [], datasets: [] }
  }

  // Find the longest dataset to determine chart width
  const maxLength = Math.max(...visibleResults.map(p => p.raw_values.length))

  // Check if we have mixed data types (legacy + heat load)
  const hasHeatLoad = visibleResults.some(p => p.timeInfo?.isHeatLoad)
  const hasLegacy = visibleResults.some(p => !p.timeInfo?.isHeatLoad)

  let labels: string[] = []

  if (hasHeatLoad && !hasLegacy) {
    // All heat load data - use the first heat load's time configuration
    const heatLoadResult = visibleResults.find(p => p.timeInfo?.isHeatLoad)
    labels = generateTimeLabels(heatLoadResult?.timeInfo, maxLength)
  } else if (hasLegacy && !hasHeatLoad) {
    // All legacy data - use month labels
    labels = monthLabels.slice(0, maxLength)
  } else {
    // Mixed data - use generic time labels
    labels = Array.from({ length: maxLength }, (_, i) => `Point ${i + 1}`)
  }

  const datasets = visibleResults.map((p, i) => ({
    label: p.timeInfo?.isHeatLoad ? `Heat ${p.jobId.replace('_heat', '').slice(-4)}` : `Proc ${p.jobId.slice(-4)}`,
    data: p.raw_values,
    borderColor: colors[i % colors.length],
    backgroundColor: colors[i % colors.length] + '33',
    fill: false,
    tension: 0.2,
    pointRadius: 0,
  }))

  return {
    labels,
    datasets,
  }
})


const chartOptions = computed(() => {
  const visibleResults = processResultsForObject.value.filter(p => p.visible)
  const hasHeatLoad = visibleResults.some(p => p.timeInfo?.isHeatLoad)
  const hasLegacy = visibleResults.some(p => !p.timeInfo?.isHeatLoad)

  let chartTitle = 'Process Results'
  let xAxisTitle = 'Time'
  let yAxisTitle = 'Values'

  if (hasHeatLoad && !hasLegacy) {
    chartTitle = 'Heat Load Values'
    yAxisTitle = 'Heat Load (kWh)'
    // Determine time scale from first heat load result
    const heatLoadResult = visibleResults.find(p => p.timeInfo?.isHeatLoad)
    if (heatLoadResult?.timeInfo) {
      const timeStep = Math.abs(heatLoadResult.timeInfo.stopTime - heatLoadResult.timeInfo.startTime) / heatLoadResult.timeInfo.intervals
      if (timeStep >= 86400) {
        xAxisTitle = 'Days'
      } else if (timeStep >= 3600) {
        xAxisTitle = 'Hours'
      } else {
        xAxisTitle = 'Time Intervals'
      }
    }
  } else if (hasLegacy && !hasHeatLoad) {
    chartTitle = 'Daily Values'
    xAxisTitle = 'Month'
    yAxisTitle = 'Heating Load'
  } else {
    chartTitle = 'Mixed Process Results'
    xAxisTitle = 'Data Points'
    yAxisTitle = 'Values'
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: { display: true, text: chartTitle },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: {
        title: { display: true, text: xAxisTitle },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 20,
          font: { size: 10 },
        },
      },
      y: { title: { display: true, text: yAxisTitle } },
    },
  }
})

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
const newAdditionalPropertyName = ref('')
const newAdditionalPropertyValue = ref('')

const isMapRoute = computed(() => route.path === '/')

const additionalInfo = computed(() => {
  return additionalInfoStore.getFeatureInfo(props.featureID)
})

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

const updateAdditionalProperty = (name: string, value: string): void => {
  const info = additionalInfoStore.getFeatureInfo(props.featureID)
  if (info && info.properties) {
    // Convert numeric strings to numbers if possible
    const numericValue = !isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value
    info.properties[name] = numericValue
  }
}

const removeAdditionalProperty = (name: string): void => {
  const info = additionalInfoStore.getFeatureInfo(props.featureID)
  if (info && info.properties) {
    delete info.properties[name]
  }
}

const addAdditionalProperty = (): void => {
  if (!newAdditionalPropertyName.value.trim()) return

  const info = additionalInfoStore.getFeatureInfo(props.featureID)
  if (info) {
    if (!info.properties) {
      info.properties = {}
    }
    // Convert numeric strings to numbers if possible
    const numericValue = !isNaN(Number(newAdditionalPropertyValue.value)) && newAdditionalPropertyValue.value.trim() !== ''
      ? Number(newAdditionalPropertyValue.value)
      : newAdditionalPropertyValue.value
    info.properties[newAdditionalPropertyName.value] = numericValue
  } else {
    // Create new additional info entry if it doesn't exist
    const numericValue = !isNaN(Number(newAdditionalPropertyValue.value)) && newAdditionalPropertyValue.value.trim() !== ''
      ? Number(newAdditionalPropertyValue.value)
      : newAdditionalPropertyValue.value

    const newFeatureInfo = {
      type: 'Feature' as const,
      id: props.featureID,
      geometry: null,
      properties: {
        [newAdditionalPropertyName.value]: numericValue
      },
      links: []
    }
    additionalInfoStore.addFeatureInfo(newFeatureInfo)
  }

  newAdditionalPropertyName.value = ''
  newAdditionalPropertyValue.value = ''
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
