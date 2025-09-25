<script setup lang="ts">
import { ref } from 'vue'
import { v5 as uuidv5 } from 'uuid'

import { useCjStore } from '@/stores/cjStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useMapStore } from '@/stores/mapStore'
import { useAdditionalInfoStore } from '@/stores/additionalInfoStore'

import { validateUrl, loadDataFromApi, fetchCollections, calculateBbox } from '@/utils/apiUtils'
import {
  isValidCityJSONSeqFile,
  processFileStream,
  mergeData,
  createCollectionFromFile,
} from '@/utils/fileUtils'

import type {
  ApiCollection,
  LocalCollection,
  CityJSONDocument,
  CityJSONFeature,
} from '@/types/cityjson'

const NAMESPACE = uuidv5('twin-city', uuidv5.DNS)
const STORAGE_KEY = 'cityjson-settings'

const cjStore = useCjStore()
const notificationStore = useNotificationStore()
const mapStore = useMapStore()
const additionalInfoStore = useAdditionalInfoStore()

const apiUrl = ref<string>(import.meta.env.VITE_BACKEND_FEATURES || '')
const collections = ref<ApiCollection[]>([])
const isLoading = ref<boolean>(false)
const error = ref<string | null>(null)
const successMessage = ref<string>('')
const limit = ref<number>(1000)
const offset = ref<number>(0)
const queryParams = ref<string>('')
const dragActive = ref<boolean>(false)

// Second API for additional information
const additionalApiUrl = ref<string>('')
const additionalCollections = ref<ApiCollection[]>([])
const additionalIsLoading = ref<boolean>(false)
const additionalError = ref<string | null>(null)
const additionalSuccessMessage = ref<string>('')
const selectedAdditionalCollection = ref<ApiCollection | null>(null)
const additionalQueryParams = ref<string>('')

const handleDragEnter = (e: DragEvent): void => {
  e.preventDefault()
  e.stopPropagation()
  dragActive.value = true
}

const handleDragLeave = (e: DragEvent): void => {
  e.preventDefault()
  e.stopPropagation()
  dragActive.value = false
}

const handleDrop = async (e: DragEvent): Promise<void> => {
  e.preventDefault()
  e.stopPropagation()
  dragActive.value = false

  if (e.dataTransfer?.files?.length) {
    await handleFileSelection(e.dataTransfer.files[0])
  }
}

const handleFileInput = async (e: Event): Promise<void> => {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    await handleFileSelection(target.files[0])
  }
}

const handleFileSelection = async (file: File): Promise<void> => {
  if (!isValidCityJSONSeqFile(file)) {
    notificationStore.show('Please select a valid .city.jsonl file', 'error')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const { base, features } = await processFileStream(file)
    base.metadata!.geographicalExtent = calculateBbox(features, base)
    updateStoreData(file, base, features)
    notificationStore.show('Successfully loaded file', 'success')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    notificationStore.show(`Error processing file: ${message}`, 'error')
    error.value = message
  } finally {
    isLoading.value = false
  }
}

const updateStoreData = (file: File, base: CityJSONDocument, features: CityJSONFeature[]): void => {
  cjStore.updating = true

  cjStore.cjBase = base
  cjStore.cjFeatures = features.map((feature) => ({
    ...feature,
    uuid: feature.uuid || uuidv5(feature.id, NAMESPACE),
  }))

  const collectionFromFile = createCollectionFromFile(file, base, features)
  cjStore.setCurrentCollection(collectionFromFile as unknown as ApiCollection, null)

  cjStore.setLoaded(true)
  const epsgCode = base.metadata?.referenceSystem?.split('/').pop()
  if (epsgCode) mapStore.setCurrentCRS(epsgCode)

  cjStore.updating = false
  cjStore.isChanged = false
}

const saveSettings = (): void => {
  if (!cjStore.currentCollection.id) return
  const settings = {
    apiUrl: apiUrl.value,
    selectedCollection: cjStore.currentCollection.id,
    limit: limit.value,
    offset: offset.value,
    queryParams: queryParams.value,
    additionalApiUrl: additionalApiUrl.value,
    selectedAdditionalCollection: selectedAdditionalCollection.value?.id || null,
    additionalQueryParams: additionalQueryParams.value,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

const handleApiUrlInput = async (): Promise<void> => {
  if (validateUrl(apiUrl.value)) {
    isLoading.value = true
    error.value = null
    try {
      apiUrl.value = apiUrl.value.trim().replace(/\/$/, '')
      collections.value = await fetchCollections(apiUrl.value)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Error fetching collections: ${message}`
      collections.value = []
    } finally {
      isLoading.value = false
    }
  } else {
    error.value = 'Please enter a valid URL'
    collections.value = []
  }
}

const handleCollectionSelect = async (collection: ApiCollection): Promise<void> => {
  isLoading.value = true
  error.value = null
  successMessage.value = ''

  try {
    await loadDataFromApi(apiUrl.value, collection, {
      limit: limit.value,
      offset: offset.value,
      queryParams: queryParams.value,
      cjStore,
      onSuccess: () => {
        successMessage.value = `Loaded ${cjStore.cjFeatures.length} features (offset: ${offset.value}, limit: ${limit.value})`
        saveSettings()
      },
      onError: (err: any) => {
        error.value = `Error fetching features: ${err.message || 'Unknown error'}`
        successMessage.value = ''
      },
    })
  } finally {
    isLoading.value = false
  }
}

const handleLimitChange = (): void => {
  if (limit.value < 1) limit.value = 1
}

const handleOffsetChange = (): void => {
  if (offset.value < 0) offset.value = 0
}

const loadSettings = (): void => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.apiUrl) apiUrl.value = settings.apiUrl
      if (settings.limit) limit.value = settings.limit
      if (settings.offset) offset.value = settings.offset
      if (settings.queryParams) queryParams.value = settings.queryParams
      if (settings.additionalApiUrl) additionalApiUrl.value = settings.additionalApiUrl
      if (settings.additionalQueryParams) additionalQueryParams.value = settings.additionalQueryParams
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error)
    }
  }
}

// Load settings on component mount
loadSettings()

// Additional API functions
const handleAdditionalApiUrlInput = async (): Promise<void> => {
  if (validateUrl(additionalApiUrl.value)) {
    additionalIsLoading.value = true
    additionalError.value = null
    try {
      additionalApiUrl.value = additionalApiUrl.value.trim().replace(/\/$/, '')
      additionalCollections.value = await fetchCollections(additionalApiUrl.value)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      additionalError.value = `Error fetching collections: ${message}`
      additionalCollections.value = []
    } finally {
      additionalIsLoading.value = false
    }
  } else {
    additionalError.value = 'Please enter a valid URL'
    additionalCollections.value = []
  }
}

const handleAdditionalCollectionSelect = async (collection: ApiCollection): Promise<void> => {
  selectedAdditionalCollection.value = collection
  additionalSuccessMessage.value = `Selected collection: ${collection.title}`

  // Set up the connection in the additional info store
  additionalInfoStore.setConnectedCollection(collection, additionalApiUrl.value, additionalQueryParams.value)

  saveSettings()
  notificationStore.show(`Additional collection selected: ${collection.title}`, 'info')
}

const fetchAdditionalInformation = async (): Promise<void> => {
  if (!selectedAdditionalCollection.value || !cjStore.cjFeatures.length) {
    notificationStore.show('Please select both main data and additional collection first', 'error')
    return
  }

  additionalIsLoading.value = true
  additionalError.value = null

  try {
    // Extract all feature IDs from the loaded CityJSON features
    const featureIds = cjStore.cjFeatures.map(feature => feature.id)

    // Fetch additional information for all features
    await additionalInfoStore.fetchAllAdditionalInfo(featureIds)

    additionalSuccessMessage.value = `Fetched additional information for ${additionalInfoStore.loadingProgress.completed} out of ${featureIds.length} features`

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    additionalError.value = `Error fetching additional information: ${message}`
  } finally {
    additionalIsLoading.value = false
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">CityJSON Data Selection</h1>
        <p class="text-gray-600">Load CityJSONSeq data from a file or OGC Features API</p>
      </div>

      <!-- File Upload Section -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700"> Load from File </label>
        <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md"
          :class="{ 'border-blue-500 bg-blue-50': dragActive }" @dragenter="handleDragEnter"
          @dragleave="handleDragLeave" @dragover.prevent @drop="handleDrop">
          <div class="space-y-1 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="flex text-sm text-gray-600">
              <label class="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
                <span>Upload a file</span>
                <input type="file" class="sr-only" accept=".city.jsonl" @change="handleFileInput" />
              </label>
              <p class="pl-1">or drag and drop</p>
            </div>
            <p class="text-xs text-gray-500">CityJSONSeq (.city.jsonl) files only</p>
          </div>
        </div>
        <!-- <div class="flex items-center mt-2">
          <input type="checkbox" id="merge" v-model="shouldMerge"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
          <label for="merge" class="ml-2 block text-sm text-gray-900">
            Merge with existing data (if compatible)
          </label>
        </div> -->
      </div>

      <!-- Separator -->
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-300"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-white text-gray-500">Or</span>
        </div>
      </div>

      <div class="space-y-2">
        <label for="apiUrl" class="block text-sm font-medium text-gray-700">
          OGC Features API URL
        </label>
        <div class="flex gap-2">
          <input id="apiUrl" v-model="apiUrl" type="url"
            class="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="https://example.com/api" />
          <button @click="handleApiUrlInput"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            :disabled="isLoading">
            {{ isLoading ? 'Loading...' : 'Connect' }}
          </button>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div v-if="collections.length > 0" class="flex gap-4 items-center">
        <div class="flex-1 space-y-2">
          <label for="limit" class="block text-sm font-medium text-gray-700">
            Limit (items per page)
          </label>
          <input id="limit" v-model.number="limit" type="number" min="1"
            class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            @change="handleLimitChange" />
        </div>
        <div class="flex-1 space-y-2">
          <label for="offset" class="block text-sm font-medium text-gray-700"> Offset </label>
          <input id="offset" v-model.number="offset" type="number" min="0"
            class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            @change="handleOffsetChange" />
        </div>
        <div class="space-y-2">
          <label for="queryParams" class="block text-sm font-medium text-gray-700">
            Additional Query Parameters
          </label>
          <input id="queryParams" v-model="queryParams" type="text"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="e.g., filter=property=value&bbox=0,0,1,1" @change="saveSettings" />
          <p class="text-xs text-gray-500">
            Enter additional query parameters in URL format (param1=value1&amp;param2=value2)
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error</h3>
            <div class="mt-2 text-sm text-red-700">
              <p>{{ error }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Features Summary -->
      <div v-if="successMessage" class="rounded-md bg-green-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-green-800">Data Loaded Successfully</h3>
            <div class="mt-2 text-sm text-green-700">
              <p>{{ successMessage }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Collections Grid -->
      <div v-if="collections.length > 0" class="grid grid-cols-1 gap-6">
        <div v-for="collection in collections" :key="collection.id"
          class="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200"
          :class="{ 'ring-2 ring-blue-500': cjStore.currentCollection.id === collection.id }">
          <div class="p-6">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ collection.title }}
                </h3>
                <p class="mt-1 text-sm text-gray-600">ID: {{ collection.id }}</p>
              </div>
              <button @click="handleCollectionSelect(collection)"
                class="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                :disabled="isLoading">
                {{
                  isLoading && cjStore.currentCollection.id === collection.id
                    ? 'Loading...'
                    : 'Select'
                }}
              </button>
            </div>

            <div class="mt-4 space-y-2">
              <p class="text-sm text-gray-600">{{ collection.description }}</p>

              <div class="flex items-center gap-4 text-sm text-gray-600">
                <span class="flex items-center">
                  <svg class="h-5 w-5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  Type: {{ collection.itemType }}
                </span>

                <span class="flex items-center">
                  <svg class="h-5 w-5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Items: {{ collection.numOfItems ? collection.numOfItems : 'No items' }}
                </span>
                <span v-if="collection.storageCrs" class="flex items-center">
                  <svg class="h-5 w-5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                  </svg>
                  Storage CRS: {{ collection.storageCrs }}
                </span>
              </div>

              <div v-if="collection.extent?.spatial?.bbox || collection.extent?.temporal?.interval"
                class="mt-2 text-sm text-gray-600">
                <p class="font-medium">Extent:</p>
                <template v-if="collection.extent.spatial?.bbox">
                  <p class="ml-2">Spatial: {{ collection.extent.spatial.bbox.join(', ') }}</p>
                </template>
                <template v-if="collection.extent.spatial?.crs">
                  <p class="ml-2">CRS: {{ collection.extent.spatial.crs }}</p>
                </template>
                <template v-if="collection.extent.temporal?.interval">
                  <p class="ml-2">
                    Temporal: {{ collection.extent.temporal.interval.join(' to ') }}
                  </p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Additional Information API Section -->
      <div v-if="cjStore.isLoaded" class="mt-8 border-t border-gray-200 pt-8">
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Additional Information API</h2>
          <p class="text-gray-600">Connect to a second Features API to enrich your data with additional attributes</p>
        </div>

        <div class="space-y-6">
          <!-- Additional API URL Input -->
          <div class="space-y-2">
            <label for="additionalApiUrl" class="block text-sm font-medium text-gray-700">
              Additional Information API URL
            </label>
            <div class="flex gap-2">
              <input id="additionalApiUrl" v-model="additionalApiUrl" type="url"
                class="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="https://example.com/additional-info-api" />
              <button @click="handleAdditionalApiUrlInput"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                :disabled="additionalIsLoading">
                {{ additionalIsLoading ? 'Loading...' : 'Connect' }}
              </button>
            </div>
          </div>

          <!-- Additional Query Parameters -->
          <div v-if="additionalCollections.length > 0" class="space-y-2">
            <label for="additionalQueryParams" class="block text-sm font-medium text-gray-700">
              Additional Query Parameters
            </label>
            <input id="additionalQueryParams" v-model="additionalQueryParams" type="text"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., filter=property=value" @change="saveSettings" />
            <p class="text-xs text-gray-500">
              Enter query parameters to filter the additional information
            </p>
          </div>

          <!-- Additional API Loading State -->
          <div v-if="additionalIsLoading" class="text-center py-4">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent">
            </div>
          </div>

          <!-- Additional API Error Display -->
          <div v-if="additionalError" class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{{ additionalError }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional API Success Message -->
          <div v-if="additionalSuccessMessage" class="rounded-md bg-green-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">Additional Information Connected</h3>
                <div class="mt-2 text-sm text-green-700">
                  <p>{{ additionalSuccessMessage }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Collections Grid -->
          <div v-if="additionalCollections.length > 0" class="grid grid-cols-1 gap-6">
            <div v-for="collection in additionalCollections" :key="collection.id"
              class="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 border-l-4 border-green-500"
              :class="{ 'ring-2 ring-green-500': selectedAdditionalCollection?.id === collection.id }">
              <div class="p-6">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">
                      {{ collection.title }}
                    </h3>
                    <p class="mt-1 text-sm text-gray-600">ID: {{ collection.id }}</p>
                  </div>
                  <div class="flex gap-2">
                    <button @click="handleAdditionalCollectionSelect(collection)"
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                      {{
                        selectedAdditionalCollection?.id === collection.id
                          ? 'Selected'
                          : 'Select'
                      }}
                    </button>
                    <button v-if="selectedAdditionalCollection?.id === collection.id && cjStore.cjFeatures.length > 0"
                      @click="fetchAdditionalInformation"
                      :disabled="additionalIsLoading || additionalInfoStore.isLoading"
                      class="inline-flex items-center px-3 py-1.5 border border-green-600 text-sm font-medium rounded-md shadow-sm text-green-600 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      {{
                        additionalInfoStore.isLoading
                          ? `Fetching... (${additionalInfoStore.getLoadingPercentage}%)`
                          : 'Fetch Info'
                      }}
                    </button>
                  </div>
                </div>

                <div class="mt-4 space-y-2">
                  <p class="text-sm text-gray-600">{{ collection.description }}</p>

                  <div class="flex items-center gap-4 text-sm text-gray-600">
                    <span class="flex items-center">
                      <svg class="h-5 w-5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Type: {{ collection.itemType }}
                    </span>

                    <span class="flex items-center">
                      <svg class="h-5 w-5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Items: {{ collection.numOfItems ? collection.numOfItems : 'No items' }}
                    </span>
                  </div>

                  <!-- Progress indicator -->
                  <div v-if="additionalInfoStore.isLoading && selectedAdditionalCollection?.id === collection.id"
                    class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div class="flex items-center">
                      <div class="flex-shrink-0">
                        <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent">
                        </div>
                      </div>
                      <div class="ml-3 flex-1">
                        <p class="text-sm text-blue-800 font-medium">
                          Fetching additional information... ({{ additionalInfoStore.getLoadingPercentage }}%)
                        </p>
                        <div class="mt-2 w-full bg-blue-200 rounded-full h-2">
                          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: `${additionalInfoStore.getLoadingPercentage}%` }"></div>
                        </div>
                        <p class="text-xs text-blue-600 mt-1">
                          {{ additionalInfoStore.loadingProgress.completed }} completed,
                          {{ additionalInfoStore.loadingProgress.failed }} failed,
                          {{ additionalInfoStore.loadingProgress.total - additionalInfoStore.loadingProgress.completed -
                            additionalInfoStore.loadingProgress.failed }} pending
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Additional info summary -->
                  <div
                    v-if="additionalInfoStore.isLoaded && selectedAdditionalCollection?.id === collection.id && additionalInfoStore.featuresInfo.size > 0"
                    class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div class="flex items-center">
                      <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm text-green-800 font-medium">
                          Additional information loaded for {{ additionalInfoStore.featuresInfo.size }} features
                        </p>
                        <p class="text-xs text-green-600 mt-1">
                          Data is now available and can be viewed in the Features tab
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm text-yellow-800">
                          <strong>Note:</strong> Additional information will be fetched for each building based on
                          matching
                          feature IDs.
                          Make sure the feature IDs in this collection correspond to the IDs in your main dataset.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
