<template>
  <table class="table-auto border-collapse w-full text-left">
    <thead>
      <tr>
        <th class="px-4 py-2">X</th>
        <th class="px-4 py-2">Y</th>
        <th class="px-4 py-2">Z</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(vertexIndex, index) in boundaries" :key="index" class="border-t">
        <td class="py-2 pl-1 pr-0.5">
          <input type="number" v-model="translatedVerts[vertexIndex][0]"
            class="w-full px-2 py-1 border border-gray-300 rounded-md" />
        </td>
        <td class="py-2 pl-1 pr-0.5">
          <input type="number" v-model="translatedVerts[vertexIndex][1]"
            class="w-full px-2 py-1 border border-gray-300 rounded-md" />
        </td>
        <td class="py-2 pl-1 pr-0.5">
          <input type="number" v-model="translatedVerts[vertexIndex][2]"
            class="w-full px-2 py-1 border border-gray-300 rounded-md" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  boundaries: {
    type: Array as PropType<number[]>,
    required: true,
  },
  translatedVerts: {
    type: Array as PropType<number[][]>,
    required: true,
  },
})
</script>

<style scoped>
/* to hyde spinners */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  appearance: none;
  /* For other browsers */
  -moz-appearance: textfield;
  /* For Firefox */
}
</style>
