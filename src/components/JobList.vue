<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { cancelJob, getJobResults } from '@/utils/processApiUtils'
import { useJobResultsStore } from '@/stores/jobResultsStore'
import type { Job, JobStatusType } from '@/types/processes'

const props = defineProps<{
  jobs: Job[]
  newJobId: string | null
}>()

const jobResultsStore = useJobResultsStore()
const error = ref<string>('')
const selectedJob = ref<(Job & { results?: any }) | null>(null)
const highlightedJobId = ref<string | null>(null)
const hiddenJobs = ref<Set<string>>(new Set())
const showingHiddenJobs = ref<boolean>(false)

onMounted(() => {
  const saved = localStorage.getItem('hiddenJobs')
  if (saved) {
    hiddenJobs.value = new Set(JSON.parse(saved))
  }
})

watch(
  hiddenJobs,
  (newValue) => {
    localStorage.setItem('hiddenJobs', JSON.stringify([...newValue]))
  },
  { deep: true },
)

const filteredJobs = computed<Job[]>(() => {
  return props.jobs
    .filter((job) =>
      showingHiddenJobs.value ? hiddenJobs.value.has(job.jobID) : !hiddenJobs.value.has(job.jobID),
    )
    .sort((a, b) => {
      // sort by creation date, newest first
      return new Date(b.created).getTime() - new Date(a.created).getTime()
    })
})

const toggleJobVisibility = (jobId: string): void => {
  if (hiddenJobs.value.has(jobId)) {
    hiddenJobs.value.delete(jobId)
  } else {
    hiddenJobs.value.add(jobId)
  }
  hiddenJobs.value = new Set(hiddenJobs.value)
}

const toggleShowHidden = (): void => {
  showingHiddenJobs.value = !showingHiddenJobs.value
}

watch(
  () => props.newJobId,
  (newId) => {
    if (newId) {
      highlightedJobId.value = newId
      setTimeout(() => {
        highlightedJobId.value = null
      }, 10000)
    }
  },
)

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const formatDateUTC = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
}

const viewResults = async (job: Job): Promise<void> => {
  if (job.status !== 'successful') return
  try {
    const results = await getJobResults(job.jobID)
    selectedJob.value = { ...job, results }
  } catch (e) {
    error.value = 'Failed to load job results'
  }
}

const handleCancel = async (jobId: string): Promise<void> => {
  try {
    await cancelJob(jobId)
  } catch (e) {
    error.value = 'Failed to cancel job'
  }
}

const saveResult = async (job: Job): Promise<void> => {
  try {
    const results = await getJobResults(job.jobID)
    jobResultsStore.saveJobResult(job.jobID, job.processID, results)
  } catch (e) {
    error.value = 'Failed to save job results'
  }
}

const removeSavedResult = (jobId: string): void => {
  jobResultsStore.removeJobResult(jobId)
}

const getStatusColor = (status: JobStatusType): string => {
  const colorMap: Record<JobStatusType, string> = {
    successful: 'text-green-600',
    failed: 'text-red-600',
    running: 'text-blue-600',
    accepted: 'text-gray-600',
    dismissed: 'text-gray-500',
  }
  return colorMap[status] || 'text-gray-600'
}
</script>

<template>
  <div class="bg-white shadow rounded-lg p-6 flex flex-col h-[calc(100vh-8rem)]">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Jobs</h2>
      <button @click="toggleShowHidden" class="px-3 py-1 rounded text-sm"
        :class="showingHiddenJobs ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'">
        {{ showingHiddenJobs ? 'Show Non-Hidden Jobs' : 'Show Hidden Jobs' }}
        <span class="ml-1 text-xs">
          ({{ showingHiddenJobs ? props.jobs.length - hiddenJobs.size : hiddenJobs.size }})
        </span>
      </button>
    </div>

    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div class="space-y-4 pr-2">
        <div v-for="job in filteredJobs" :key="job.jobID" :class="[
          'border rounded p-4 transition-colors duration-300 bg-slate-100 hover:bg-gray-200',
          highlightedJobId === job.jobID ? 'bg-blue-500 border-blue-500' : '',
        ]">
          <div class="flex flex-col space-y-2">
            <div class="flex justify-between items-start">
              <div class="min-w-0 flex-shrink">
                <!-- Add min-w-0 to allow truncation -->
                <h3 class="font-medium truncate">{{ job.processID }}</h3>
                <p class="text-sm text-gray-600">Job ID: {{ job.jobID }}</p>
                <p :class="['font-medium', getStatusColor(job.status)]">
                  {{ job.status }}
                </p>
                <p class="text-sm text-gray-600">
                  Started:
                  <span :title="formatDateUTC(job.created)" class="cursor-help">
                    {{ formatDate(job.created) }}
                  </span>
                </p>
                <p v-if="job.finished" class="text-sm text-gray-600">
                  Finished:
                  <span :title="formatDateUTC(job.finished)" class="cursor-help">
                    {{ formatDate(job.finished) }}
                  </span>
                </p>
              </div>

              <div class="flex flex-nowrap items-center space-x-2 ml-4">
                <button @click="toggleJobVisibility(job.jobID)"
                  class="whitespace-nowrap text-gray-600 hover:text-gray-800">
                  {{ hiddenJobs.has(job.jobID) ? 'Unhide' : 'Hide' }}
                </button>
                <button v-if="job.status === 'running'" @click="handleCancel(job.jobID)"
                  class="whitespace-nowrap text-red-600 hover:text-red-800">
                  Cancel
                </button>
                <button v-if="job.status === 'successful'" @click="viewResults(job)"
                  class="whitespace-nowrap text-blue-600 hover:text-blue-800">
                  View Results
                </button>
                <button v-if="job.status === 'successful' && !jobResultsStore.hasSavedResult(job.jobID)"
                  @click="saveResult(job)" class="whitespace-nowrap text-green-600 hover:text-green-800">
                  Load Result
                </button>
                <button v-if="jobResultsStore.hasSavedResult(job.jobID)" @click="removeSavedResult(job.jobID)"
                  class="whitespace-nowrap text-yellow-600 hover:text-yellow-800">
                  Unload Result
                </button>
              </div>
            </div>
          </div>

          <div v-if="job.status === 'running' && job.progress !== undefined" class="mt-2 h-2 bg-gray-200 rounded">
            <div class="h-full bg-blue-500 rounded" :style="{ width: `${job.progress}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedJob" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Results for {{ selectedJob.processID }}</h3>

        <pre class="bg-gray-50 p-4 rounded overflow-auto max-h-96">
          {{ JSON.stringify(selectedJob.results, null, 2) }}
        </pre>

        <div class="flex justify-end mt-4 space-x-2">
          <button v-if="!jobResultsStore.hasSavedResult(selectedJob.jobID)" @click="saveResult(selectedJob)"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Load Result
          </button>
          <button @click="selectedJob = null" class="px-4 py-2 border rounded hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
