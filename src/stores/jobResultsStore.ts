import { defineStore } from 'pinia';
import type { JobResult } from '@/types/jobs';

export interface JobResultsState {
  savedResults: JobResult[];
}

export const useJobResultsStore = defineStore('jobResults', {
  state: (): JobResultsState => ({
    savedResults: [],
  }),

  actions: {
    saveJobResult(jobId: string, processId: string, results: any): void {
      const existingIndex = this.savedResults.findIndex(r => r.jobId === jobId);

      const newResult: JobResult = {
        jobId,
        processId,
        results,
        savedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        this.savedResults[existingIndex] = newResult;
      } else {
        this.savedResults.push(newResult);
      }
    },

    removeJobResult(jobId: string): void {
      this.savedResults = this.savedResults.filter(r => r.jobId !== jobId);
    },

    clearAllResults(): void {
      this.savedResults = [];
    }
  },

  getters: {
    getSavedResult: (state: JobResultsState) => {
      return (jobId: string): JobResult | undefined => 
        state.savedResults.find(r => r.jobId === jobId);
    },
    
    getAllSavedResults: (state: JobResultsState): JobResult[] => {
      return state.savedResults;
    },
    
    hasSavedResult: (state: JobResultsState) => {
      return (jobId: string): boolean => 
        state.savedResults.some(r => r.jobId === jobId);
    },
  }
});