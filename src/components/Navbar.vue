<template>
  <nav class="bg-gray-900 text-white fixed top-0 right-0 h-12 flex items-center z-40 w-full transition-all duration-300"
    :class="isExpanded ? 'pl-64' : 'pl-16'">
    <div class="text-xl font-bold px-4">TwinCity3000 Viewer</div>
    <div class="flex-1"></div>
    <div class="p-2 flex">
      <button v-if="true" @click="showSaveConfirm = true" :disabled="cjStore.updating"
        class="bg-green-500 hover:bg-green-700 text-white font-bold px-4 rounded ml-2 flex items-center"
        :class="{ 'opacity-75 cursor-not-allowed': cjStore.updating }">
        <svg v-if="cjStore.updating" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
          </path>
        </svg>
        {{ cjStore.updating ? 'Saving...' : 'Save' }}
      </button>

      <button v-if="closeSmth" @click="closeFct"
        class="bg-red-500 hover:bg-red-700 text-white font-bold px-4 rounded ml-2">
        Close
      </button>
    </div>
    <div v-if="showSaveConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showSaveConfirm = false">
      <div class="bg-gray-800 text-white rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-lg font-bold mb-4">Save Changes</h3>
        <p class="text-gray-300 mb-4">
          This will download your changes as a
          <a href="https://www.cityjson.org/cityjsonseq/" target="_blank" rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 underline">
            CityJSONSeq
          </a>
          file. Would you like to continue?
        </p>
        <div class="flex justify-end space-x-4">
          <button @click="showSaveConfirm = false" class="px-4 py-2 text-sm font-bold text-gray-300 hover:text-white">
            Cancel
          </button>
          <button @click="handleSave"
            class="px-4 py-2 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded">
            Download File
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCjStore } from '@/stores/cjStore'

interface Props {
  isExpanded?: boolean
  closeSmth?: boolean
  closeFct?: () => void
}

withDefaults(defineProps<Props>(), {
  isExpanded: false,
  closeSmth: false,
  closeFct: () => {
    console.log('Close Function')
  },
})

const cjStore = useCjStore()
const showSaveConfirm = ref<boolean>(false)

const handleSave = async (): Promise<void> => {
  showSaveConfirm.value = false
  await cjStore.saveChanges()
}
</script>
