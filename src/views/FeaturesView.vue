<template>
  <div class="p-5 bg-slate-200">
    <!-- Search Controls -->
    <div class="mb-4 space-y-4">
      <div class="flex gap-2">
        <button @click="invertSelection"
          class="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 flex-1">
          Invert Selection
        </button>
        <button @click="deleteSelectedFeatures"
          class="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 flex-1">
          Delete Selected Features
        </button>
        <button @click="resetSelection" class="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 flex-1">
          Reset Selection
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Search by ID</label>
          <input type="text" v-model="searchById" placeholder="Enter ID" class="w-full px-2 py-1.5 border rounded" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Attribute</label>
          <div class="flex gap-2">
            <select v-model="selectedAttributeKey" class="flex-1 px-2 py-1.5 border rounded">
              <option value="">Select Field</option>
              <option v-for="key in attributeKeys" :key="key" :value="key">{{ key }}</option>
            </select>
            <input v-if="selectedAttributeKey" type="text" v-model="searchByAttributeValue" placeholder="Value"
              class="flex-1 px-2 py-1.5 border rounded" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Address</label>
          <div class="flex gap-2">
            <select v-model="selectedAddressKey" class="flex-1 px-2 py-1.5 border rounded">
              <option value="">Select Field</option>
              <option v-for="key in addressKeys" :key="key" :value="key">{{ key }}</option>
            </select>
            <input v-if="selectedAddressKey" type="text" v-model="searchByAddressValue" placeholder="Value"
              class="flex-1 px-2 py-1.5 border rounded" />
          </div>
        </div>
      </div>
    </div>

    <div class="h-0.5 bg-gray-700 mx-3 mb-4"></div>

    <!-- Features List -->
    <div class="space-y-4">
      <div v-for="feature in filteredFeatures" :key="feature.id" :class="{
        'ring-2 ring-green-500': isFeatFocused(feature.id),
        hidden: !hasMatchInFeature(feature),
      }" class="p-2 rounded">
        <div class="flex items-center gap-2 mb-2">
          <div @click="handleFeatureClick(feature)" class="flex items-center gap-2 cursor-pointer flex-1">
            <FeatureIcon :type="feature.CityObjects[feature.id].type"
              class="w-5 h-5 min-w-5 min-h-5 bg-slate-800 rounded b-2" />
            <span class="font-bold">Feature ID: {{ feature.id }}</span>
            <span v-if="Object.keys(feature.CityObjects).length > 1" class="text-xs">
              ({{ isExpanded[feature.id] ? '▼' : '▶' }})
            </span>
          </div>

          <button @click="handleFocus(feature.id)" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
            Focus
          </button>
          <button @click="handleSelect(feature.id)"
            class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            {{ isFeatureSelected(feature.id) ? 'Deselect' : 'Select' }}
          </button>
        </div>

        <div v-show="shouldShowChildren(feature)">
          <div v-for="(cityObject, objectId) in feature.CityObjects" :key="objectId" class="ml-4 p-2">
            <div class="font-semibold mb-2">Object ID: {{ getShortId(feature.id, objectId) }}</div>

            <!-- Attributes -->
            <div v-if="cityObject.attributes" class="mb-2">
              <div class="font-semibold mb-1">Attributes:</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 ml-4">
                <div v-for="(value, name) in cityObject.attributes" :key="name" class="contents">
                  <div class="font-medium truncate">{{ name }}:</div>
                  <input type="text" v-model="cityObject.attributes[name]" class="border rounded px-1" @click.stop />
                </div>
              </div>
            </div>

            <!-- Address -->
            <div v-if="cityObject.address?.length" class="mb-2">
              <div class="font-semibold mb-1">Address:</div>
              <div v-for="(addr, index) in cityObject.address" :key="index"
                class="grid grid-cols-2 gap-x-4 gap-y-2 ml-4">
                <div v-for="(value, key) in addr" :key="key" class="contents">
                  <div class="font-medium truncate">{{ key }}:</div>
                  <input type="text" v-model="addr[key]" class="border rounded px-1" @click.stop />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="h-0.5 bg-gray-700 mx-3 mt-4"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCjStore } from '@/stores/cjStore'
import { singleSelStore, multiSelStore } from '@/stores/selectionStore'
import FeatureIcon from '@/components/FeatureIcon.vue'
import type { CityJSONFeature } from '@/types/cityjson'

const cjStore = useCjStore()
const sSelStore = singleSelStore()
const mSelStore = multiSelStore()

const isExpanded = ref<Record<string, boolean>>({})

const searchById = ref<string>('')
const selectedAttributeKey = ref<string>('')
const selectedAddressKey = ref<string>('')
const searchByAttributeValue = ref<string>('')
const searchByAddressValue = ref<string>('')

const attributeKeys = computed<string[]>(() => {
  const keys = new Set<string>()
  cjStore.cjFeatures.forEach((feature) => {
    Object.values(feature.CityObjects).forEach((obj) => {
      if (obj.attributes) {
        Object.keys(obj.attributes).forEach((key) => keys.add(key))
      }
    })
  })
  return Array.from(keys)
})

const addressKeys = computed<string[]>(() => {
  const keys = new Set<string>()
  cjStore.cjFeatures.forEach((feature) => {
    Object.values(feature.CityObjects).forEach((obj) => {
      if (obj.address?.length) {
        // Assuming all address objects have the same keys
        Object.keys(obj.address[0]).forEach((key) => keys.add(key))
      }
    })
  })
  return Array.from(keys)
})

const matchesSearch = (value: any, search: string): boolean => {
  if (!search) return true
  return String(value).toLowerCase().includes(search.toLowerCase())
}

const hasMatchInFeature = (feature: CityJSONFeature): boolean => {
  if (
    searchById.value &&
    !matchesSearch(feature.id, searchById.value) &&
    !Object.keys(feature.CityObjects).some((objId) => matchesSearch(objId, searchById.value))
  ) {
    return false
  }
  if (
    selectedAttributeKey.value &&
    searchByAttributeValue.value &&
    !Object.values(feature.CityObjects).some((obj) =>
      matchesSearch(obj.attributes?.[selectedAttributeKey.value], searchByAttributeValue.value),
    )
  ) {
    return false
  }
  if (
    selectedAddressKey.value &&
    searchByAddressValue.value &&
    !Object.values(feature.CityObjects).some((obj) =>
      obj.address?.some((addr) =>
        matchesSearch(addr[selectedAddressKey.value], searchByAddressValue.value),
      ),
    )
  ) {
    return false
  }
  return true
}

const filteredFeatures = computed<CityJSONFeature[]>(() =>
  cjStore.cjFeatures.filter(hasMatchInFeature),
)

const handleFeatureClick = (feature: CityJSONFeature): void => {
  const objectCount = Object.keys(feature.CityObjects).length
  if (objectCount > 1) {
    isExpanded.value[feature.id] = !isExpanded.value[feature.id]
  } else {
    sSelStore.selFeatID = feature.id
    sSelStore.selFeatElemID = Object.keys(feature.CityObjects)[0]
    sSelStore.selCounter++
  }
}

const handleSelect = (featureId: string): void => {
  if (isFeatureSelected(featureId)) {
    delete mSelStore.selFeatures[featureId]
  } else {
    const feature = cjStore.cjFeatures.find((f) => f.id === featureId)
    if (feature) {
      mSelStore.selFeatures[featureId] = Object.keys(feature.CityObjects)
    }
  }
}

const invertSelection = (): void => {
  const newSelection: Record<string, string[]> = {}
  cjStore.cjFeatures.forEach((feature) => {
    if (!(feature.id in mSelStore.selFeatures)) {
      newSelection[feature.id] = Object.keys(feature.CityObjects)
    }
  })
  mSelStore.selFeatures = newSelection
}

const handleFocus = (featureId: string): void => {
  const feature = cjStore.cjFeatures.find((f) => f.id === featureId)
  if (feature) {
    sSelStore.selFeatID = featureId
    sSelStore.selFeatElemID = Object.keys(feature.CityObjects)[0]
    sSelStore.selCounter++
  }
}

const isFeatFocused = (featureId: string): boolean => sSelStore.selFeatID === featureId
const isFeatureSelected = (featureId: string): boolean => featureId in mSelStore.selFeatures
const shouldShowChildren = (feature: CityJSONFeature): boolean =>
  Object.keys(feature.CityObjects).length === 1 || isExpanded.value[feature.id]

const getShortId = (featureId: string, objectId: string): string => {
  if (objectId.startsWith(featureId)) {
    return objectId.length === featureId.length ? objectId : '*' + objectId.slice(featureId.length)
  }
  return objectId
}

const deleteSelectedFeatures = (): void => {
  cjStore.cjFeatures = cjStore.cjFeatures.filter(
    (feature) => !(feature.id in mSelStore.selFeatures),
  )
  mSelStore.selFeatures = {}
}

const resetSelection = (): void => {
  mSelStore.selFeatures = {}
  sSelStore.selFeatID = null
  sSelStore.selFeatElemID = null
  isExpanded.value = {}
  sSelStore.selCounter = 0
}
</script>
