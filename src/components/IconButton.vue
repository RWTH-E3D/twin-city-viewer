<template>
  <button @click="handleClick" :class="[
    'flex items-center justify-center p-1 rounded-xl transition',
    sizeClass,
    isActive ? activeColorClasses : 'bg-slate-700 hover:bg-slate-600',
  ]">
    <component :is="iconComponent" class="w-full h-full" />
  </button>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

interface Props {
  icon: string
  size?: 'sm' | 'md' | 'lg'
  isActive?: boolean
  activeColor?: 'green' | 'blue' | 'red' | 'yellow' | 'purple' | 'pink' | 'indigo'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  isActive: false,
  activeColor: 'green',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const sizeClass = computed<string>(() => {
  switch (props.size) {
    case 'sm':
      return 'w-6 h-6'
    case 'lg':
      return 'w-10 h-10'
    default:
      return 'w-8 h-8'
  }
})

const activeColorClasses = computed<string>(() => {
  switch (props.activeColor) {
    case 'green':
      return 'bg-green-600 hover:bg-green-600 hover:scale-110'
    case 'blue':
      return 'bg-blue-600 hover:bg-blue-600 hover:scale-110'
    case 'red':
      return 'bg-red-600 hover:bg-red-600 hover:scale-110'
    case 'yellow':
      return 'bg-yellow-600 hover:bg-yellow-600 hover:scale-110'
    case 'purple':
      return 'bg-purple-600 hover:bg-purple-600 hover:scale-110'
    case 'pink':
      return 'bg-pink-600 hover:bg-pink-600 hover:scale-110'
    case 'indigo':
      return 'bg-indigo-600 hover:bg-indigo-600 hover:scale-110'
    default:
      return 'bg-green-600 hover:bg-green-600 hover:scale-110'
  }
})

const iconComponent = defineAsyncComponent(() => import(`@/assets/svg/${props.icon}.svg`))

function handleClick(event: MouseEvent): void {
  emit('click', event)
}
</script>
