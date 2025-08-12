<template>
  <router-link
    :to="linkPath"
    class="flex items-center space-x-4 p-4 hover:bg-gray-700 [&>:first-child]:hover:scale-110"
  >
    <component :is="iconComponent" class="min-w-6 duration-300 transition-all max-w-6 max-h-6" />
    <span
      class="truncate transition-all duration-300 ease-in-out scale-0"
      :class="{ 'scale-100': isExpanded }"
    >
      {{ label }}
    </span>
  </router-link>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

interface Props {
  linkPath: string
  isExpanded: boolean
  svgName: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Someone forgot to put a name',
})

const iconComponent = defineAsyncComponent(() => import(`@/assets/svg/${props.svgName}.svg`))
</script>

<style scoped></style>
