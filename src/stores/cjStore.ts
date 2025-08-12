import { defineStore } from 'pinia'
import { useNotificationStore } from './notificationStore'
import type {
  CityJSONDocument,
  CityJSONFeature,
  ApiCollection,
  CollectionState,
} from '@/types/cityjson'

export interface CjState {
  cjBase: CityJSONDocument | null
  cjFeatures: CityJSONFeature[]
  isChanged: boolean
  updating: boolean
  isLoaded: boolean
  initialState: {
    cjBase: CityJSONDocument | null
    cjFeatures: CityJSONFeature[]
  }
  currentCollection: CollectionState
}

export const useCjStore = defineStore('cjStore', {
  state: (): CjState => ({
    cjBase: null,
    cjFeatures: [],
    isChanged: false,
    updating: false,
    isLoaded: false,
    initialState: {
      cjBase: null,
      cjFeatures: [],
    },
    currentCollection: {
      id: null,
      title: null,
      description: null,
      itemType: null,
      numOfItems: 0,
      extent: {
        spatial: { bbox: null, crs: null },
        temporal: { interval: null },
      },
      apiUrl: null,
      limit: 1000,
      offset: 0,
    },
  }),

  actions: {
    setCurrentCollection(
      collection: ApiCollection,
      apiUrl: string | null,
      limit = 1000,
      offset = 0,
    ): void {
      this.currentCollection = {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        itemType: collection.itemType,
        numOfItems: collection.numOfItems || 0,
        extent: {
          spatial: {
            bbox: collection.extent?.spatial?.bbox || null,
            crs: collection.extent?.spatial?.crs || null,
          },
          temporal: {
            interval: collection.extent?.temporal?.interval || null,
          },
        },
        apiUrl: apiUrl,
        limit,
        offset,
      }
    },

    clearCurrentCollection(): void {
      this.currentCollection = {
        id: null,
        title: null,
        description: null,
        itemType: null,
        numOfItems: 0,
        extent: {
          spatial: { bbox: null, crs: null },
          temporal: { interval: null },
        },
        apiUrl: null,
        limit: 1000,
        offset: 0,
      }
    },

    setLoaded(value: boolean): void {
      this.isLoaded = value
      if (value) {
        this.initialState = {
          cjBase: JSON.parse(JSON.stringify(this.cjBase)),
          cjFeatures: JSON.parse(JSON.stringify(this.cjFeatures)),
        }
      }
    },

    checkForChanges(): boolean {
      if (!this.isLoaded || this.updating) return false

      const currentBaseStr = JSON.stringify(this.cjBase)
      const currentFeaturesStr = JSON.stringify(this.cjFeatures)
      const initialBaseStr = JSON.stringify(this.initialState.cjBase)
      const initialFeaturesStr = JSON.stringify(this.initialState.cjFeatures)

      this.isChanged =
        currentBaseStr !== initialBaseStr || currentFeaturesStr !== initialFeaturesStr
      return this.isChanged
    },

    resetInitialState(): void {
      this.initialState = {
        cjBase: JSON.parse(JSON.stringify(this.cjBase)),
        cjFeatures: JSON.parse(JSON.stringify(this.cjFeatures)),
      }
      this.isChanged = false
    },

    async saveChanges(): Promise<boolean> {
      const notificationStore = useNotificationStore()

      try {
        this.updating = true
        notificationStore.show('Preparing file for download...', 'info')

        const cleanFeatures = this.cjFeatures.map((feature) => {
          const { uuid, ...rest } = feature
          return rest
        })

        const ndjsonContent = [
          JSON.stringify(this.cjBase),
          ...cleanFeatures.map((feature) => JSON.stringify(feature)),
        ].join('\n')

        const blob = new Blob([ndjsonContent], { type: 'application/x-ndjson' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = this.currentCollection.id
          ? `${this.currentCollection.id}_${timestamp}.city.jsonl`
          : `cityjson_${timestamp}.city.jsonl`

        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()

        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        this.resetInitialState()
        notificationStore.show('File saved successfully', 'success')
        return true
      } catch (error: unknown) {
        console.error('Error saving file:', error)
        const message = error instanceof Error ? error.message : 'An unknown error occurred.'
        notificationStore.show(`Failed to save file: ${message}`, 'error')
        return false
      } finally {
        this.updating = false
      }
    },
  },
})
