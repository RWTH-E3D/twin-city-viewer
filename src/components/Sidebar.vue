<template>
  <div
    :class="[
      'bg-gray-900 text-white h-full fixed top-0 left-0 z-50 transition-all duration-300 ease-in-out flex flex-col',
      isExpanded ? 'w-full sm:w-64' : 'w-16',
    ]"
  >
    <!-- Fixed Header -->
    <div class="flex-none">
      <button
        @click="toggleSidebar"
        class="flex space-x-4 h-12 p-4 hover:bg-gray-700 focus:outline-none rotate-0 transition-300 ease-in-out w-full"
      >
        <SidebarIcon :class="{ 'rotate-180': isExpanded }" class="max-w-6" />
      </button>
      <SidebarLink linkPath="/" :isExpanded="isExpanded" svgName="MapIcon" label="Map" />
      <div
        v-if="isMapRoute"
        class="transition-all duration-300 ease-in-out scale-0 flex"
        :class="{ 'scale-100': isExpanded }"
      >
        <div v-if="isExpanded" class="flex mb-1 pl-2">
          <div class="flex">
            <IconButton
              icon="PickIcon"
              size="md"
              :isActive="mapOperation === 'Pick'"
              @click="handleMapOperation('Pick')"
              title="Selection tool"
            />
            <IconButton
              icon="AddIcon"
              size="md"
              :isActive="mapOperation === 'Add'"
              @click="handleMapOperation('Add')"
              title="Building creation"
            />
          </div>
          <div class="flex pl-1">
            <IconButton
              icon="CirclePinIcon"
              size="md"
              :isActive="hasSavedCameraPosition"
              @click="saveCameraPosition"
              title="Save camera position"
            />
            <IconButton
              icon="MapPinIcon"
              size="md"
              :isActive="isCameraPositionLoaded"
              @click="loadCameraPosition"
              title="Go to saved camera position"
            />
          </div>
          <div class="flex pl-1">
            <IconButton
              icon="CameraAdd"
              size="md"
              :isActive="false"
              @click="takePicture"
              title="Save map to image"
            />
          </div>
          <div class="flex pl-1">
            <IconButton
              icon="MapIcon"
              size="md"
              :isActive="!hidingMap"
              @click="toggleMap"
              active-color="red"
              title="Toggle map"
            />
          </div>
        </div>
      </div>
      <div class="h-0.5 bg-gray-700 mx-3"></div>
      <SidebarLink
        linkPath="/Features"
        :isExpanded="isExpanded"
        svgName="ListIcon"
        label="Features"
      />
    </div>

    <!-- Scrollable Middle Section -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <SidebarFeatureList :isExpanded="isExpanded" />
    </div>

    <!-- Fixed Footer -->
    <div class="flex-none">
      <div class="h-0.5 bg-gray-700 mx-3"></div>
      <ul>
        <li>
          <SidebarLink
            linkPath="/selection"
            :isExpanded="isExpanded"
            svgName="ApiIcon"
            label="Collection selection"
          />
        </li>
        <li>
          <SidebarLink
            linkPath="/processes"
            :isExpanded="isExpanded"
            svgName="TaskIcon"
            label="Processes"
          />
        </li>
        <li>
          <SidebarLink
            linkPath="/settings"
            :isExpanded="isExpanded"
            svgName="SettingsIcon"
            label="Settings"
          />
        </li>
        <li>
          <SidebarLink
            linkPath="/about"
            :isExpanded="isExpanded"
            svgName="AboutIcon"
            label="About"
          />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import SidebarFeatureList from './Sidebar/SidebarFeatureList.vue'
import SidebarLink from './Sidebar/SidebarLink.vue'
import SidebarIcon from '@/assets/svg/SidebarIcon.svg'
import IconButton from './IconButton.vue'
import { useMapStore } from '@/stores/mapStore'

interface Props {
  isExpanded: boolean
  toggleSidebar: () => void
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  toggleSidebar: () => {},
})

const mapStore = useMapStore()

const route = useRoute()
const isMapRoute = computed(() => route.path === '/')

const mapOperation = computed(() => mapStore.activeOperation)

const handleMapOperation = (operation: string) => {
  if (mapStore.canSwitchOperation) {
    if (operation === mapStore.activeOperation) {
      mapStore.activeOperation = null
    } else if (operation === 'Pick') {
      mapStore.activeOperation = 'Pick'
    } else if (operation === 'Add') {
      mapStore.activeOperation = 'Add'
    }
  }
}

const saveCameraPosition = () => {
  mapStore.saveCamera = !mapStore.saveCamera
}
const hasSavedCameraPosition = computed(() => mapStore.hasSavedCamera)

const loadCameraPosition = () => {
  if (mapStore.hasSavedCamera) {
    mapStore.loadCamera = !mapStore.loadCamera
  }
}
const isCameraPositionLoaded = computed(() => mapStore.currEqSaved)
const takePicture = () => {
  mapStore.pictureLamp = !mapStore.pictureLamp
}
const hidingMap = computed(() => mapStore.showMap)
const toggleMap = () => {
  mapStore.showMap = !mapStore.showMap
}
</script>
