<template>
  <div class="p-6">
    <!-- Map Settings Section -->
    <div class="bg-slate-300 p-4 rounded shadow-md mb-4">
      <h2 class="text-lg font-bold mb-3">Map Settings</h2>

      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2"> Base Style URL </label>
        <div class="flex gap-2">
          <input v-model="baseStyleUrl"
            class="flex-1 shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text" placeholder="Enter Mapbox style URL" />
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2"> Terrain Source URL </label>
        <div class="flex gap-2">
          <input v-model="terrainSourceUrl"
            class="flex-1 shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text" placeholder="Enter terrain source URL" />
        </div>
      </div>

      <button @click="confirmResetMapSettings"
        class="bg-gray-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
        Reset Map Settings
      </button>
    </div>

    <div class="bg-slate-300 p-4 rounded shadow-md mb-4">
      <h2 class="text-lg font-bold mb-3">Global Opacity (Maximum)</h2>
      <div class="flex items-center">
        <span class="text-sm font-medium w-6">A:</span>
        <input type="range" min="0" max="1" step="0.01" v-model.number="store.defaultOpacity"
          @input="updateDefaultOpacity" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
        <span class="ml-2 text-sm w-12">{{ Math.round(store.defaultOpacity * 100) }}%</span>
      </div>
      <div class="text-xs text-gray-600 mt-1">Each surface's opacity cannot exceed this value.</div>
    </div>

    <div class="bg-slate-300 p-4 rounded shadow-md mb-4">
      <div class="flex">
        <h2 class="text-lg font-bold mb-3">Add New Surface</h2>
        <div class="flex-1"></div>
        <div class="flex justify-end mt-2">
          <button @click="confirmResetSurfaces"
            class="bg-gray-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Reset All Surfaces
          </button>
        </div>
      </div>

      <div class="flex gap-4 mb-4">
        <div class="flex-1">
          <label class="block text-gray-700 text-sm font-bold mb-2"> Surface Name </label>
          <input v-model="newSurfaceName"
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text" placeholder="Enter surface name" />
        </div>
        <div class="flex items-end">
          <button @click="addSurface"
            class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            :disabled="!newSurfaceName">
            Add Surface
          </button>
        </div>
      </div>
    </div>

    <div class="bg-slate-300 p-4 rounded shadow-md">
      <div v-for="(color, surface) in store.semanticSurfaces" :key="surface" class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-gray-700 text-sm font-bold">
            {{ surface }}
          </label>
          <div class="flex items-center gap-2">
            <!-- Color preview -->
            <div class="w-8 h-8 rounded border border-gray-400" :style="{
              backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
            }"></div>
            <!-- Delete button -->
            <button @click="removeSurface(surface)" class="text-red-500 hover:text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center">
            <span class="text-sm font-medium w-6">R:</span>
            <input type="range" min="0" max="255" step="1" v-model.number="color.r" @input="updateColor(surface, color)"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
            <span class="ml-2 text-sm w-12">{{ color.r }}</span>
          </div>

          <div class="flex items-center">
            <span class="text-sm font-medium w-6">G:</span>
            <input type="range" min="0" max="255" step="1" v-model.number="color.g" @input="updateColor(surface, color)"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
            <span class="ml-2 text-sm w-12">{{ color.g }}</span>
          </div>

          <div class="flex items-center">
            <span class="text-sm font-medium w-6">B:</span>
            <input type="range" min="0" max="255" step="1" v-model.number="color.b" @input="updateColor(surface, color)"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
            <span class="ml-2 text-sm w-12">{{ color.b }}</span>
          </div>

          <div class="flex items-center">
            <span class="text-sm font-medium w-6">A:</span>
            <input type="range" min="0" :max="store.defaultOpacity" step="0.01" v-model.number="color.a"
              @input="updateColor(surface, color)"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
            <span class="ml-2 text-sm w-12">{{ Math.round(color.a * 100) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSemanticColorsStore, useMapStore } from '@/stores/mapStore'
import { ref, watch } from 'vue'
import type { RGBAColor } from '@/types/map'

const store = useSemanticColorsStore()
const mapStore = useMapStore()

const newSurfaceName = ref<string>('')

const baseStyleUrl = ref<string>(mapStore.baseStyleUrl)
const terrainSourceUrl = ref<string>(mapStore.terrainSourceUrl)

watch(baseStyleUrl, (newValue) => {
  mapStore.updateBaseStyle(newValue)
})

watch(terrainSourceUrl, (newValue) => {
  mapStore.updateTerrainSource(newValue)
})

const confirmResetMapSettings = (): void => {
  if (confirm('Are you sure you want to reset map settings to defaults?')) {
    mapStore.resetMapSettings()
    // Re-sync local refs after reset
    baseStyleUrl.value = mapStore.baseStyleUrl
    terrainSourceUrl.value = mapStore.terrainSourceUrl
  }
}

const updateColor = (surface: string, color: RGBAColor): void => {
  store.updateColor(surface, color)
}

const updateDefaultOpacity = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const newMax = parseFloat(target.value)
  store.setDefaultOpacity(newMax)
  // Clamp all surface opacities to the new maximum
  Object.entries(store.semanticSurfaces).forEach(([surface, color]) => {
    if (color.a > newMax) {
      color.a = newMax
      store.updateColor(surface, color)
    }
  })
}

const addSurface = (): void => {
  if (newSurfaceName.value && !store.semanticSurfaces[newSurfaceName.value]) {
    store.addSurface(newSurfaceName.value) // Default color is handled in store
    newSurfaceName.value = ''
  }
}

const removeSurface = (surface: string): void => {
  if (confirm(`Are you sure you want to remove the surface "${surface}"?`)) {
    store.removeSurface(surface)
  }
}

const confirmResetSurfaces = (): void => {
  if (confirm('Are you sure you want to reset all colors to their defaults?')) {
    store.resetToDefault()
  }
}
</script>
