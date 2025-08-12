<template>
  <component :is="icon" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

interface Props {
  type: string
}

const props = defineProps<Props>()

const icon = computed(() => {
  return defineAsyncComponent(() => import(`@/assets/svg/${props.type}Icon.svg`))
})
</script>
