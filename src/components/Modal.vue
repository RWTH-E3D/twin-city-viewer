<!-- Modal.vue -->
<template>
  <Transition name="modal-fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        @click="$emit('update:modelValue', false)"
      ></div>

      <!-- Modal Content -->
      <div class="relative w-full max-w-lg bg-white rounded-lg shadow-xl p-6 m-4">
        <!-- Close button -->
        <button
          @click="$emit('update:modelValue', false)"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <!-- Title -->
        <h2 class="text-xl font-bold mb-4">{{ title }}</h2>

        <!-- Content slot -->
        <div class="space-y-4">
          <slot></slot>
        </div>

        <!-- Footer slot -->
        <div class="mt-6 flex justify-end space-x-3">
          <slot name="footer">
            <button
              @click="$emit('update:modelValue', false)"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              @click="$emit('submit')"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Submit
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Modal Title',
})

defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
}>()
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
