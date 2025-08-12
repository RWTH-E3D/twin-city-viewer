import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Ref } from 'vue';

export const singleSelStore = defineStore('singleSelectionStore', () => {
  const selFeatID: Ref<string | null> = ref(null);
  const selFeatElemID: Ref<string | null> = ref(null);

  const selCounter = ref<number>(0);
  
  return { selFeatID, selFeatElemID, selCounter };
});


export const multiSelStore = defineStore('multiSelectionStore', () => {
  const selFeatures = ref<Record<string, string[]>>({});

  const selCounter = ref<number>(0);

  return { selFeatures, selCounter };
});