<template>
  <li class="flex flex-col items-start text-gray-400 text-xs cursor-pointer px-0.5 rounded"
    :class="{ 'bg-green-700 text-white': isFocused }" :title="feature.id">
    <div @click="handleClick"
      class="w-full flex items-center group hover:bg-slate-600 rounded-md hover:text-gray-100 relative" :class="{
        'bg-red-800 hover:bg-red-600 text-gray-50': isParentSelected,
        'hover:bg-green-600': isFocused,
      }">
      <div class="flex items-center space-x-2 min-w-0 flex-1">
        <Icon class="w-5 h-5 flex-shrink-0" />
        <span class="truncate">{{ feature.id }}</span>
      </div>
      <button
        class="absolute right-0 opacity-0 group-hover:opacity-100 text-gray-300 rounded hover:text-white px-2 bg-red-800 transition-opacity"
        @click.stop="handleSelect(feature.id, 'parent')">
        {{ isParentSelected ? 'Deselect' : 'Select' }}
      </button>
    </div>
    <ul v-show="open" class="w-full pl-5 list-disc py-0.5">
      <li v-for="(featureChild, index) in featureMemberIDsShort" :key="featureChild"
        @click="handleFeatureClick(feature.id, featureChild)"
        class="w-full flex items-center group hover:bg-slate-600 rounded-md hover:text-gray-100 relative pl-1" :class="{
          'bg-red-800 hover:bg-red-700 text-gray-50': isChildSelected(featureMemberIDs[index]),
          'bg-green-900': isChildFocused(featureChild),
        }">
        <span class="truncate min-w-0 flex-1">{{ featureChild }}</span>
        <button
          class="absolute right-0 opacity-0 group-hover:opacity-100 text-gray-300 rounded hover:text-white px-2 bg-red-800 transition-opacity"
          @click.stop="handleSelect(featureMemberIDs[index], 'child')">
          {{ isChildSelected(featureMemberIDs[index]) ? 'Deselect' : 'Select' }}
        </button>
      </li>
    </ul>
  </li>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent, computed } from 'vue'
import { singleSelStore, multiSelStore } from '@/stores/selectionStore'
import type { CityJSONFeature } from '@/types/cityjson'

const props = defineProps<{
  feature: CityJSONFeature
}>()

const sSelStore = singleSelStore()
const mSelStore = multiSelStore()

const open = ref(false)

const isFocused = computed<boolean>(() => sSelStore.selFeatID === props.feature.id)
const isParentSelected = computed<boolean>(() => props.feature.id in mSelStore.selFeatures)

const isChildFocused = (cityObjectShortID: string): boolean => {
  const fullId = cityObjectShortID.startsWith('*')
    ? props.feature.id + cityObjectShortID.slice(1)
    : cityObjectShortID
  return sSelStore.selFeatID === props.feature.id && sSelStore.selFeatElemID === fullId
}

const isChildSelected = (cityObjectID: string): boolean => {
  return mSelStore.selFeatures[props.feature.id]?.includes(cityObjectID) ?? false
}

const featureMemberIDs = Object.keys(props.feature.CityObjects)

const featureMemberIDsShort = computed<string[]>(() => {
  const shortIds = featureMemberIDs.map((id) => {
    if (id.startsWith(props.feature.id) && id.length > props.feature.id.length) {
      return '*' + id.slice(props.feature.id.length)
    }
    return id
  })

  return shortIds.sort((a, b) => {
    if (a === props.feature.id) return -1
    if (b === props.feature.id) return 1
    return a.localeCompare(b)
  })
})

const handleClick = (): void => {
  if (Object.keys(props.feature.CityObjects).length > 1) {
    open.value = !open.value
  } else {
    sSelStore.selFeatID = props.feature.id
    sSelStore.selFeatElemID = Object.keys(props.feature.CityObjects)[0]
    sSelStore.selCounter++
  }
}

const handleFeatureClick = (featureID: string, featureElementIDShort: string): void => {
  sSelStore.selFeatID = featureID
  const fullId = featureElementIDShort.startsWith('*')
    ? featureID + featureElementIDShort.slice(1)
    : featureElementIDShort
  sSelStore.selFeatElemID = fullId
  sSelStore.selCounter++
}

const handleSelect = (id: string, type: 'parent' | 'child'): void => {
  if (type === 'parent') {
    if (isParentSelected.value) {
      delete mSelStore.selFeatures[props.feature.id]
    } else {
      mSelStore.selFeatures[props.feature.id] = [...featureMemberIDs]
    }
  } else if (type === 'child') {
    if (!mSelStore.selFeatures[props.feature.id]) {
      mSelStore.selFeatures[props.feature.id] = []
    }

    const objectIds = mSelStore.selFeatures[props.feature.id]
    const index = objectIds.indexOf(id)

    if (index === -1) {
      objectIds.push(id)
    } else {
      objectIds.splice(index, 1)
      if (objectIds.length === 0) {
        delete mSelStore.selFeatures[props.feature.id]
      }
    }
  }
}

const Icon = defineAsyncComponent(() => {
  const typeName = props.feature.CityObjects[props.feature.id]?.type || 'Default'
  return import(`@/assets/svg/${typeName}Icon.svg`)
})
</script>
