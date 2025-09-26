<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import ProcessList from '@/components/ProcessList.vue'
import JobList from '@/components/JobList.vue'
import { fetchProcesses, fetchJobs } from '@/utils/processApiUtils'
import type { Process, Job } from '@/types/processes'

const apiEndpoint = ref<string>(
  localStorage.getItem('apiEndpoint') || import.meta.env.VITE_BACKEND_PROCESSES,
)
const isEditingEndpoint = ref<boolean>(false)
const tempEndpoint = ref<string>('')

const processes = shallowRef<Process[]>([])
const jobs = shallowRef<Job[]>([])

const loading = ref<boolean>(false)
const error = ref<string>('')
const isInitialLoad = ref<boolean>(true)
const newJobId = ref<string | null>(null)
const pollInterval: Ref<number | null> = ref(null)

const handleJobCreated = (jobId: string): void => {
  newJobId.value = jobId
  setTimeout(() => {
    loadData()
  }, 500)
  setTimeout(() => {
    newJobId.value = null
  }, 5000)
}

watch(apiEndpoint, (newValue) => {
  localStorage.setItem('apiEndpoint', newValue)
})

const editEndpoint = (): void => {
  tempEndpoint.value = apiEndpoint.value
  isEditingEndpoint.value = true
}

const saveEndpoint = (): void => {
  try {
    new URL(tempEndpoint.value)
    apiEndpoint.value = tempEndpoint.value
    isEditingEndpoint.value = false
    loadData()
  } catch {
    error.value = 'Please enter a valid URL'
  }
}

const cancelEdit = (): void => {
  isEditingEndpoint.value = false
  tempEndpoint.value = apiEndpoint.value
}

const loadData = async (): Promise<void> => {
  if (isInitialLoad.value) {
    loading.value = true
  }

  error.value = ''
  try {
    const [processesData, jobsData] = await Promise.all([
      fetchProcesses(apiEndpoint.value),
      fetchJobs(apiEndpoint.value),
    ])

    if (JSON.stringify(processes.value) !== JSON.stringify(processesData.processes)) {
      processes.value = processesData.processes
    }
    if (JSON.stringify(jobs.value) !== JSON.stringify(jobsData.jobs)) {
      jobs.value = jobsData.jobs
    }
  } catch (e: unknown) {
    error.value = 'Failed to load data from the specified API endpoint.'
    console.error(e)
  } finally {
    loading.value = false
    isInitialLoad.value = false
  }
}

const startPolling = (): void => {
  if (pollInterval.value) clearInterval(pollInterval.value)
  pollInterval.value = setInterval(loadData, 5000)
}

const stopPolling = (): void => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
}

onMounted(() => {
  loadData()
  startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="container mx-auto p-4 bg-slate-300 h-full">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Process Manager</h1>

      <!-- API Endpoint Configuration -->
      <div class="flex items-center gap-2 bg-slate-200 rounded p-1">
        <span class="text-sm text-gray-600">API:</span>
        <div v-if="!isEditingEndpoint" class="flex items-center gap-2">
          <span class="text-sm font-mono">{{ apiEndpoint }}</span>
          <button @click="editEndpoint" class="text-blue-600 hover:text-blue-800 text-sm">
            Edit
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input v-model="tempEndpoint" type="text" class="border rounded px-2 py-1 text-sm w-64"
            placeholder="Enter API endpoint" />
          <button @click="saveEndpoint" class="text-green-600 hover:text-green-800 text-sm">
            Save
          </button>
          <button @click="cancelEdit" class="text-gray-600 hover:text-gray-800 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Error alert -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Loading state -->
    <div v-if="loading && isInitialLoad" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>

    <!-- Content -->
    <div v-if="!isInitialLoad" class="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
      <ProcessList :processes="processes" :base-u-r-l="apiEndpoint" @job-created="handleJobCreated" />
      <JobList :jobs="jobs" :new-job-id="newJobId ?? null" :base-u-r-l="apiEndpoint" />
    </div>
  </div>
</template>
