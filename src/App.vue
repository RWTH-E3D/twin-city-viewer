<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Navbar from './components/Navbar.vue'
import Sidebar from './components/Sidebar.vue'
import CityObjectComp from './components/CityObjectComp.vue'

import type {
  CityJSONDocument,
  CityJSONFeature,
  CityObject,
  Vertices,
  ApiCollection,
  LoadDataOptions,
} from '@/types/cityjson'

import { useCjStore } from '@/stores/cjStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { singleSelStore, multiSelStore } from '@/stores/selectionStore'
import { useMapStore } from './stores/mapStore'
import {
  validateUrl,
  loadDataFromApi,
  getFirstCollection,
  fetchCollections,
} from '@/utils/apiUtils'
import { v5 as uuidv5 } from 'uuid'

const NAMESPACE = uuidv5('twin-city', uuidv5.DNS)
const STORAGE_KEY = 'cityjson-settings'

const router = useRouter()
const cjStore = useCjStore()
const notificationStore = useNotificationStore()
const sSelStore = singleSelStore()
const mSelStore = multiSelStore()
const mapStore = useMapStore()

const isSidebarExpanded = ref<boolean>(localStorage.getItem('isSidebarExpanded') === 'true')
const showEdit = ref<boolean>(false)

const selFeat = ref<CityJSONFeature | null>(null)
const selObj = ref<CityObject | null>(null)
const selObjID = ref<string | null>(null)
const selFeatID = ref<string | null>(null)
const selFeatVert = ref<Vertices | null>(null)

const loadFallbackFile = async (): Promise<boolean> => {
  try {
    const response = await fetch('/example.city.jsonl')
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const text = await response.text()
    const jsonLines = text.split('\n').filter((line) => line.trim() !== '')

    const parsedData: (CityJSONDocument | CityJSONFeature)[] = jsonLines.map((line) =>
      JSON.parse(line),
    )

    cjStore.cjBase = parsedData[0] as CityJSONDocument
    cjStore.cjFeatures = parsedData.slice(1) as CityJSONFeature[]

    cjStore.cjFeatures.forEach((feature) => {
      if (!feature.uuid) {
        feature.uuid = uuidv5(feature.id, NAMESPACE)
      }
    })

    const epsgCode = cjStore.cjBase?.metadata?.referenceSystem?.split('/').pop()

    if (epsgCode) {
      mapStore.setCurrentCRS(epsgCode)
    }

    cjStore.setLoaded(true)
    cjStore.currentCollection.id = 'fallback'
  } catch (error: unknown) {
    console.error('Error loading JSON Lines file:', error)
  }
  return !!(cjStore.cjBase && cjStore.cjFeatures.length > 0)
}

const handleFeatureClick = (): void => {
  if (sSelStore.selFeatID === null || sSelStore.selFeatElemID === null) {
    showEdit.value = false
    return
  }

  const feature = cjStore.cjFeatures.find((feature) => feature.id === sSelStore.selFeatID)

  if (!feature) return

  selFeat.value = feature
  selFeatID.value = sSelStore.selFeatID
  selFeatVert.value = feature.vertices
  selObjID.value = sSelStore.selFeatElemID

  selObj.value = feature.CityObjects[sSelStore.selFeatElemID]

  if (!showEdit.value) {
    toggleShowEdit()
  }
}
watch(() => sSelStore.selCounter, handleFeatureClick)

const updateFeatVert = (newVert: Vertices): void => {
  const feature = cjStore.cjFeatures.find((feature) => feature.id === selFeatID.value)
  if (feature) {
    feature.vertices = newVert
  }
}

const handleDelete = (): void => {
  if (!selObjID.value || !selFeat.value || !selFeatID.value) return

  if (!confirm('Are you sure you want to delete this object?')) return

  const feature = cjStore.cjFeatures.find((f) => f.id === selFeatID.value)
  if (!feature) return

  if (Object.keys(feature.CityObjects).length > 1) {
    if (selFeatID.value !== selObjID.value) {
      delete feature.CityObjects[selObjID.value]

      if (selFeatID.value in mSelStore.selFeatures) {
        const index = mSelStore.selFeatures[selFeatID.value].indexOf(selObjID.value)
        if (index > -1) {
          mSelStore.selFeatures[selFeatID.value].splice(index, 1)
        }
      }
      console.log(`Removed ${selObjID.value} from feature ${selFeatID.value}`)
    } else {
      alert('This object has parts. Please delete the parts first.')
      return
    }
  } else {
    cjStore.cjFeatures = cjStore.cjFeatures.filter((f) => f.id !== selFeatID.value)
    if (selFeatID.value in mSelStore.selFeatures) {
      delete mSelStore.selFeatures[selFeatID.value]
    }
  }

  toggleShowEdit()
  selFeat.value = null
  selObj.value = null
  selObjID.value = null
  selFeatID.value = null
  selFeatVert.value = null
}

const toggleSidebar = (): void => {
  isSidebarExpanded.value = !isSidebarExpanded.value
  localStorage.setItem('isSidebarExpanded', String(isSidebarExpanded.value))
}

const toggleShowEdit = (): void => {
  showEdit.value = !showEdit.value
}

const closeDetailView = (): void => {
  showEdit.value = false
}

onMounted(async (): Promise<void> => {
  watch(
    () => [cjStore.cjBase, cjStore.cjFeatures],
    () => {
      if (!cjStore.updating) cjStore.checkForChanges()
    },
    { deep: true },
  )

  try {
    const settingsJSON = localStorage.getItem(STORAGE_KEY)
    if (settingsJSON) {
      const settings = JSON.parse(settingsJSON)
      if (settings?.apiUrl && settings?.selectedCollection) {
        const collections: ApiCollection[] = await fetchCollections(settings.apiUrl)
        const collection = collections.find((c) => c.id === settings.selectedCollection)

        if (collection) {
          const options: LoadDataOptions = {
            limit: settings.limit || 1000,
            offset: settings.offset || 0,
            queryParams: settings.queryParams || '',
            cjStore,
            onSuccess: (collectionId) =>
              notificationStore.show(`Successfully loaded collection: ${collectionId}`, 'success'),
            onError: () => notificationStore.show('Failed to load from saved settings', 'error'),
          }
          const success = await loadDataFromApi(settings.apiUrl, collection, options)
          if (success) return
        }
      }
    }
  } catch (error: unknown) {
    console.error('Error loading from localStorage:', error)
  }

  const backendUrl = import.meta.env.VITE_BACKEND_FEATURES
  if (backendUrl && validateUrl(backendUrl)) {
    const firstCollection = await getFirstCollection(backendUrl)
    if (firstCollection) {
      const options: LoadDataOptions = {
        cjStore,
        onSuccess: (collectionId) =>
          notificationStore.show(`Loaded collection from backend: ${collectionId}`, 'success'),
        onError: () => notificationStore.show('Failed to load from backend', 'error'),
      }
      const success = await loadDataFromApi(backendUrl, firstCollection, options)
      if (success) return
    }
  }

  const fallbackSuccess = await loadFallbackFile()
  if (fallbackSuccess) {
    notificationStore.show('Loaded local fallback data.', 'success')
  } else {
    notificationStore.show('Failed to load any data. Please use the Selection View.', 'error')
    router.push('/selection')
  }
})
</script>

<template>
  <div class="flex h-screen">
    <div v-if="notificationStore.isVisible"
      class="fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg transition-all duration-300" :class="{
        'bg-green-50': notificationStore.type === 'success',
        'bg-blue-50': notificationStore.type === 'info',
        'bg-red-50': notificationStore.type === 'error',
      }">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg v-if="notificationStore.type === 'success'" class="h-5 w-5 text-green-400" viewBox="0 0 20 20"
            fill="currentColor">
            <path fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd" />
          </svg>
          <svg v-else-if="notificationStore.type === 'info'" class="h-5 w-5 text-blue-400" viewBox="0 0 20 20"
            fill="currentColor">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd" />
          </svg>
          <svg v-else class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium" :class="{
            'text-green-800': notificationStore.type === 'success',
            'text-blue-800': notificationStore.type === 'info',
            'text-red-800': notificationStore.type === 'error',
          }">
            {{ notificationStore.message }}
          </p>
        </div>
      </div>
    </div>
    <Sidebar :isExpanded="isSidebarExpanded" :toggleSidebar="toggleSidebar" />

    <!-- Main Content -->
    <div :class="[
      'flex-1 flex flex-col transition-all duration-300',
      isSidebarExpanded ? 'ml-64' : 'ml-16',
      isSidebarExpanded ? 'sm:ml-64 ml-0' : 'sm:ml-16 ml-0',
    ]">
      <Navbar :isExpanded="isSidebarExpanded" :close-smth="showEdit" :close-fct="closeDetailView" />

      <!-- Main content with flex layout -->
      <div class="flex-1 pt-12 flex overflow-hidden">
        <!-- Router view with dynamic width -->
        <div :class="[
          'transition-all duration-300 overflow-auto h-full',
          showEdit ? 'w-[60%]' : 'w-full',
        ]">
          <RouterView />
        </div>

        <div v-if="showEdit" class="w-[40%] border-l border-gray-200 h-full flex flex-col">
          <CityObjectComp :city-object="selObj!" :feature-i-d="selFeatID!" :city-object-i-d="selObjID!"
            :feat-vert="selFeatVert!" :cj-base="cjStore.cjBase!" :toggleShowEdit="toggleShowEdit"
            @update:featVert="updateFeatVert" :close-smth="showEdit" :close-fct="closeDetailView"
            @delete="handleDelete" />
        </div>
      </div>
    </div>

    <!-- Overlay (for mobile) -->
    <!-- <div v-if="isSidebarExpanded" class="fixed inset-0 bg-black bg-opacity-50 sm:hidden" @click="toggleSidebar"></div> -->
  </div>
</template>

<style scoped>
html,
body {
  height: 100%;
}
</style>
