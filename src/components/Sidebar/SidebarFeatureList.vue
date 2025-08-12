<template>
  <li class="flex flex-col">
    <!-- scrollable Features List -->
    <div v-show="isExpanded" class="pl-4 overflow-y-auto flex-1">
      <ul>
        <SidebarCityJsonFeatureItem v-for="feature in cjStore.cjFeatures" :key="feature.uuid" :feature="feature" />
      </ul>
    </div>
  </li>
</template>

<script setup lang="ts">
import SidebarCityJsonFeatureItem from './SidebarCityJsonFeatureItem.vue'
import { useCjStore } from '@/stores/cjStore'

const cjStore = useCjStore()

defineProps<{
  isExpanded?: boolean
}>()
</script>
