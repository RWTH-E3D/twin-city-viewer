<script setup lang="ts">
import { ref } from 'vue'
import { startProcess } from '@/utils/processApiUtils'
import { useCjStore } from '@/stores/cjStore'
import { multiSelStore } from '@/stores/selectionStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAdditionalInfoStore } from '@/stores/additionalInfoStore'
import type { Process, ProcessInputs } from '@/types/processes'

interface JobStartResponse {
  jobID: string
}

const cjStore = useCjStore()
const mSelStore = multiSelStore()
const notificationStore = useNotificationStore()
const additionalInfoStore = useAdditionalInfoStore()

const props = defineProps<{
  processes: Process[]
  baseURL?: string
}>()

const emit = defineEmits<{
  jobCreated: [jobId: string]
}>()

const selectedProcess = ref<Process | null>(null)
const inputData = ref<Record<string, any>>({})
const error = ref<string>('')
const success = ref<string>('')

const createBuildingData = () => {
  // Get selected features or all features if none selected
  let selectedKeys = Object.keys(mSelStore.selFeatures)
  let targetFeatures = cjStore.cjFeatures
  if (selectedKeys.length > 0) {
    targetFeatures = cjStore.cjFeatures.filter((f) => selectedKeys.includes(f.id))
  }

  const buildings: any[] = []
  const missingDataFeatures: string[] = []

  for (const feature of targetFeatures) {
    const additionalInfo = additionalInfoStore.getFeatureInfo(feature.id)

    if (!additionalInfo?.properties) {
      missingDataFeatures.push(feature.id)
      continue
    }

    const props = additionalInfo.properties

    // Check if all required fields are present
    const requiredFields = ['building_type', 'construction_year', 'floor_number', 'height', 'floor_area']
    const missingFields = requiredFields.filter(field => !(field in props) || props[field] == null)

    if (missingFields.length > 0) {
      missingDataFeatures.push(feature.id)
      continue
    }

    buildings.push({
      name: feature.id,
      function: "residential",
      usage: props.building_type,
      year: props.construction_year,
      n_floors: props.floor_number,
      height: props.height,
      area: props.floor_area
    })
  }

  return { buildings, missingDataFeatures }
}

const openProcessDialog = (process: Process) => {
  selectedProcess.value = process

  // Special handling for json-build-and-simulate process
  if (process.id === 'json-build-and-simulate') {
    const { buildings, missingDataFeatures } = createBuildingData()

    if (missingDataFeatures.length > 0) {
      error.value = `Missing additional data for features: ${missingDataFeatures.join(', ')}. These buildings will be excluded from the simulation.`
    }

    inputData.value = {
      project_name: 'teaser_simulation',
      start_time: 0,
      stop_time: 86400,
      intervals: 1440,
      processes: 1,
      retrofit: 'standard',
      buildings: buildings
    }
  } else if (process.inputs && process.inputs.properties) {
    const initialData: Record<string, any> = {}
    Object.keys(process.inputs.properties).forEach((field) => {
      const schema = process.inputs?.properties[field]
      if (field === 'collection_name') {
        initialData[field] = cjStore.currentCollection.id
      } else if (field === 'new_collection_name') {
        initialData[field] = cjStore.currentCollection.id + '_new'
      } else if (field === 'cj_base') {
        initialData[field] = cjStore.cjBase
      } else if (field === 'cj_features') {
        let selectedKeys = Object.keys(mSelStore.selFeatures)
        let featureCopy = cjStore.cjFeatures.map((f) => ({ ...f }))
        if (selectedKeys.length === 0) {
          selectedKeys = featureCopy.map((f) => f.id)
        }
        initialData[field] = featureCopy.filter((f) => selectedKeys.includes(f.id))
      } else if (field === 'ids' && schema?.type === 'array') {
        initialData[field] = Object.keys(mSelStore.selFeatures)
      } else {
        initialData[field] = schema?.type === 'array' ? [] : field
      }
    })
    inputData.value = initialData
  } else {
    inputData.value = {}
  }

  if (process.id !== 'json-build-and-simulate') {
    error.value = ''
  }
  success.value = ''
}

const startJob = async () => {
  error.value = ''
  success.value = ''
  try {
    const processedInputs: Record<string, any> = {}

    // Special handling for json-build-and-simulate process - send data as-is
    if (selectedProcess.value!.id === 'json-build-and-simulate') {
      Object.assign(processedInputs, inputData.value)
    } else {
      // For other processes, apply the normal processing
      Object.entries(inputData.value).forEach(([key, value]) => {
        if (
          selectedProcess.value?.inputs?.properties[key]?.type === 'array' &&
          typeof value === 'string'
        ) {
          processedInputs[key] = value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        } else {
          processedInputs[key] = value
        }
      })
    }

    const result = (await startProcess(
      selectedProcess.value!.id,
      processedInputs as ProcessInputs,
      props.baseURL,
    )) as JobStartResponse

    notificationStore.show(
      `Process "${selectedProcess.value!.title}" started. Job ID: ${result.jobID}`,
      'success',
    )

    emit('jobCreated', result.jobID)

    success.value = 'Job started successfully'
    selectedProcess.value = null
  } catch (e: any) {
    error.value = e.response?.data?.detail || 'Failed to start job'
    notificationStore.show(error.value, 'error')
  }
}
</script>

<template>
  <div class="bg-white shadow rounded-lg p-6 flex flex-col h-[calc(100vh-8rem)]">
    <h2 class="text-xl font-semibold mb-4">Available Processes</h2>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div class="space-y-4 pr-2">
        <div v-for="process in processes" :key="process.id" class="bg-slate-100 border rounded p-4 hover:bg-gray-200">
          <h3 class="font-medium">{{ process.title }}</h3>
          <p class="text-gray-600 text-sm mt-1">{{ process.description }}</p>
          <button @click="openProcessDialog(process)"
            class="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Start Process
          </button>
        </div>
      </div>
    </div>

    <!-- Process Dialog -->
    <div v-if="selectedProcess"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto p-4">
      <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4 my-auto relative">
        <!-- Dialog content wrapper with scrollable area -->
        <div class="max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold mb-4">{{ selectedProcess.title }}</h3>
          <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {{ error }}
          </div>
          <div v-if="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {{ success }}
          </div>
          <!-- Special form for json-build-and-simulate process -->
          <div v-if="selectedProcess.id === 'json-build-and-simulate'" class="space-y-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input type="text" v-model="inputData.project_name" class="w-full border rounded px-3 py-2" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Start Time (seconds)</label>
                <input type="number" v-model="inputData.start_time" class="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Stop Time (seconds)</label>
                <input type="number" v-model="inputData.stop_time" class="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Intervals</label>
                <input type="number" v-model="inputData.intervals" class="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Processes</label>
                <input type="number" v-model="inputData.processes" class="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Retrofit Type</label>
              <select v-model="inputData.retrofit" class="w-full border rounded px-3 py-2">
                <option value="standard">Standard</option>
                <option value="retrofit">Retrofit</option>
                <option value="retrofit_adv">Retrofit Advanced</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Buildings ({{ inputData.buildings?.length || 0 }} buildings will be included)
              </label>
              <div class="max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                <div v-if="inputData.buildings && inputData.buildings.length > 0" class="space-y-2">
                  <div v-for="(building, index) in inputData.buildings" :key="index"
                    class="p-2 bg-white rounded border text-sm">
                    <div class="font-medium">{{ building.name }}</div>
                    <div class="text-gray-600 text-xs grid grid-cols-2 gap-1">
                      <span>Function: {{ building.function }}</span>
                      <span>Year: {{ building.year }}</span>
                      <span>Floors: {{ building.n_floors }}</span>
                      <span>Height: {{ building.height }}m</span>
                      <span>Area: {{ building.area }}m²</span>
                    </div>
                  </div>
                </div>
                <div v-else class="text-gray-500 text-sm py-4 text-center">
                  No buildings with complete additional data found
                </div>
              </div>
            </div>
          </div>

          <!-- Default form for other processes -->
          <div v-else-if="selectedProcess.inputs" class="space-y-4 mb-4">
            <div v-for="(schema, field) in selectedProcess.inputs.properties" :key="field">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ schema.description || field }}
              </label>
              <div v-if="schema.type === 'array' && field === 'cj_features'"
                class="max-h-60 overflow-y-auto border rounded p-2">
                <div v-for="(feature, index) in inputData[field]" :key="index" class="mb-2 p-2 bg-gray-50 rounded">
                  <span>{{ feature.id }}</span>
                </div>
              </div>
              <div v-else-if="schema.type === 'array'" class="space-y-2">
                <input type="text" v-model="inputData[field]" class="w-full border rounded px-3 py-2"
                  placeholder="Enter comma-separated values" />
                <p class="text-sm text-gray-500">
                  Min items: {{ schema.minItems }}, Max items: {{ schema.maxItems }}
                </p>
              </div>
              <div v-else-if="field === 'cj_base'" class="space-y-2">
                <span>{{ cjStore.cjBase }}</span>
              </div>
              <template v-else>
                <input v-if="schema.type === 'string'" type="text" v-model="inputData[field]"
                  class="w-full border rounded px-3 py-2" />
                <input v-else-if="schema.type === 'number'" type="number" v-model="inputData[field]"
                  class="w-full border rounded px-3 py-2" />
                <input v-else-if="schema.type === 'integer'" type="number" v-model="inputData[field]"
                  class="w-full border rounded px-3 py-2" />
                <input v-else type="text" v-model="inputData[field]" class="w-full border rounded px-3 py-2" />
              </template>
            </div>
          </div>
        </div>
        <div class="flex justify-end space-x-3 mt-4 pt-3 border-t">
          <button @click="selectedProcess = null" class="px-4 py-2 border rounded hover:bg-gray-50">
            Cancel
          </button>
          <button @click="startJob" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Start
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
