import { defineStore } from 'pinia'
import { useNotificationStore } from './notificationStore'
import type { ApiCollection } from '@/types/cityjson'

export interface AdditionalFeatureInfo {
  type: 'Feature'
  id: string
  geometry: null
  properties: Record<string, any>
  links: any[]
}

export interface AdditionalInfoState {
  isLoading: boolean
  isLoaded: boolean
  featuresInfo: Map<string, AdditionalFeatureInfo>
  connectedCollection: ApiCollection | null
  apiUrl: string | null
  queryParams: string
  loadingProgress: {
    total: number
    completed: number
    failed: number
  }
}

export const useAdditionalInfoStore = defineStore('additionalInfoStore', {
  state: (): AdditionalInfoState => ({
    isLoading: false,
    isLoaded: false,
    featuresInfo: new Map(),
    connectedCollection: null,
    apiUrl: null,
    queryParams: '',
    loadingProgress: {
      total: 0,
      completed: 0,
      failed: 0
    }
  }),

  getters: {
    getFeatureInfo: (state) => {
      return (featureId: string): AdditionalFeatureInfo | null => {
        return state.featuresInfo.get(featureId) || null
      }
    },

    getAllFeaturesInfo: (state) => {
      return Array.from(state.featuresInfo.values())
    },

    getLoadingPercentage: (state) => {
      if (state.loadingProgress.total === 0) return 0
      return Math.round((state.loadingProgress.completed / state.loadingProgress.total) * 100)
    },

    hasInfoForFeature: (state) => {
      return (featureId: string): boolean => {
        return state.featuresInfo.has(featureId)
      }
    }
  },

  actions: {
    setConnectedCollection(collection: ApiCollection, apiUrl: string, queryParams = ''): void {
      this.connectedCollection = collection
      this.apiUrl = apiUrl
      this.queryParams = queryParams
    },

    clearConnection(): void {
      this.connectedCollection = null
      this.apiUrl = null
      this.queryParams = ''
      this.featuresInfo.clear()
      this.isLoaded = false
      this.resetProgress()
    },

    addFeatureInfo(featureInfo: AdditionalFeatureInfo): void {
      this.featuresInfo.set(featureInfo.id, featureInfo)
    },

    removeFeatureInfo(featureId: string): void {
      this.featuresInfo.delete(featureId)
    },

    clearAllInfo(): void {
      this.featuresInfo.clear()
      this.isLoaded = false
      this.resetProgress()
    },

    setLoading(loading: boolean): void {
      this.isLoading = loading
      if (!loading && this.loadingProgress.total > 0) {
        this.isLoaded = true
      }
    },

    initializeProgress(total: number): void {
      this.loadingProgress = {
        total,
        completed: 0,
        failed: 0
      }
    },

    incrementCompleted(): void {
      this.loadingProgress.completed++
    },

    incrementFailed(): void {
      this.loadingProgress.failed++
    },

    resetProgress(): void {
      this.loadingProgress = {
        total: 0,
        completed: 0,
        failed: 0
      }
    },

    async fetchAllAdditionalInfo(featureIds: string[]): Promise<void> {
      if (!this.connectedCollection || !this.apiUrl) {
        throw new Error('No additional information API connected')
      }

      const notificationStore = useNotificationStore()
      
      this.setLoading(true)
      this.initializeProgress(featureIds.length)
      
      notificationStore.show(`Starting to fetch additional information for ${featureIds.length} features`, 'info')

      try {
        // Batch fetch features with a reasonable chunk size to avoid overwhelming the API
        const chunkSize = 10
        const chunks = []
        
        for (let i = 0; i < featureIds.length; i += chunkSize) {
          chunks.push(featureIds.slice(i, i + chunkSize))
        }

        for (const chunk of chunks) {
          const promises = chunk.map(id => this.fetchSingleFeatureInfo(id))
          await Promise.allSettled(promises)
        }

        const successCount = this.loadingProgress.completed
        const failedCount = this.loadingProgress.failed
        
        notificationStore.show(
          `Additional information loaded: ${successCount} successful, ${failedCount} failed`,
          failedCount > 0 ? 'error' : 'success'
        )

      } catch (error) {
        console.error('Error fetching additional information:', error)
        notificationStore.show('Failed to fetch additional information', 'error')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async fetchSingleFeatureInfo(featureId: string): Promise<AdditionalFeatureInfo | null> {
      if (!this.connectedCollection || !this.apiUrl) {
        this.incrementFailed()
        return null
      }

      try {
        const params = new URLSearchParams()
        if (this.queryParams) {
          new URLSearchParams(this.queryParams).forEach((value, key) => params.append(key, value))
        }

        const url = `${this.apiUrl}/collections/${this.connectedCollection.id}/items/${featureId}?${params}`
        
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          mode: 'cors'
        })

        if (!response.ok) {
          console.warn(`Failed to fetch info for feature ${featureId}: ${response.status}`)
          this.incrementFailed()
          return null
        }

        const featureInfo: AdditionalFeatureInfo = await response.json()
        this.addFeatureInfo(featureInfo)
        this.incrementCompleted()
        return featureInfo

      } catch (error) {
        console.error(`Error fetching info for feature ${featureId}:`, error)
        this.incrementFailed()
        return null
      }
    }
  }
})