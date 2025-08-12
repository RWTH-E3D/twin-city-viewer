import { v5 as uuidv5 } from 'uuid'
import { useMapStore } from '@/stores/mapStore'
import type {
  CityJSONDocument,
  CityJSONFeature,
  LoadDataOptions,
  ApiCollection,
} from '@/types/cityjson'

const NAMESPACE = uuidv5('twin-city', uuidv5.DNS)

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const get3DBagUrl = (
  baseUrl: string,
  endpoint: string,
): { url: string; isThreeDBagAPI: boolean } => {
  const cleanBaseUrl = baseUrl.trim().replace(/\/$/, '')
  const cleanEndpoint = endpoint.replace(/^\//, '')
  const isThreeDBagAPI = cleanBaseUrl === 'https://api.3dbag.nl'

  return {
    url: isThreeDBagAPI ? `/3dbag-api/${cleanEndpoint}` : `${cleanBaseUrl}/${cleanEndpoint}`,
    isThreeDBagAPI,
  }
}

export const calculateBbox = (features: CityJSONFeature[], cjBase: CityJSONDocument): number[] => {
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]

  features.forEach((feature) => {
    if (feature.vertices) {
      feature.vertices.forEach((vertex) => {
        const x = vertex[0] * cjBase.transform.scale[0] + cjBase.transform.translate[0]
        const y = vertex[1] * cjBase.transform.scale[1] + cjBase.transform.translate[1]
        const z = vertex[2] * cjBase.transform.scale[2] + cjBase.transform.translate[2]

        min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)]
        max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)]
      })
    }
  })
  return [...min, ...max]
}

export const loadDataFromApi = async (
  apiUrl: string,
  collection: ApiCollection,
  options: LoadDataOptions,
): Promise<boolean> => {
  const {
    limit = 1000,
    offset = 0,
    queryParams = '',
    onSuccess = () => {},
    onError = () => {},
    cjStore,
  } = options

  if (!cjStore) throw new Error('cjStore is required for loadDataFromApi')

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    if (queryParams) {
      new URLSearchParams(queryParams).forEach((value, key) => params.append(key, value))
    }

    const { url, isThreeDBagAPI } = get3DBagUrl(apiUrl, `collections/${collection.id}/items`)

    const response = await fetch(`${url}?${params}`, {
      headers: { Accept: 'application/city-json+seq' },
      ...(!isThreeDBagAPI && { mode: 'cors' }),
    })

    if (!response.ok) throw new Error('Failed to fetch features')

    const text = await response.text()
    const jsonLines = text.split('\n').filter((line) => line.trim() !== '')
    const parsedData = jsonLines.map((line) => JSON.parse(line))

    const cjBase: CityJSONDocument = parsedData[0]
    const cjFeatures: CityJSONFeature[] = parsedData.slice(1)

    if (cjBase.metadata) {
      cjBase.metadata.geographicalExtent = calculateBbox(cjFeatures, cjBase)
    }

    cjStore.updating = true
    cjStore.cjBase = cjBase
    cjStore.cjFeatures = cjFeatures

    cjStore.cjFeatures.forEach((feature: CityJSONFeature) => {
      if (!feature.uuid) {
        feature.uuid = uuidv5(feature.id, NAMESPACE)
      }
    })

    cjStore.setCurrentCollection(collection, apiUrl, limit, offset)
    cjStore.setLoaded(true)
    if (onSuccess) onSuccess(collection.id)
    return true
  } catch (error: unknown) {
    if (onError) onError(console.log(error))
    else console.error('Error loading from API:', error)
    return false
  } finally {
    if (cjStore) {
      cjStore.updating = false
      cjStore.isChanged = false
      const mapStore = useMapStore()
      const epsgCode = cjStore.cjBase?.metadata?.referenceSystem?.split('/').pop()
      if (epsgCode) {
        mapStore.setCurrentCRS(epsgCode)
      }
    }
  }
}

export const getFirstCollection = async (apiUrl: string): Promise<ApiCollection | null> => {
  try {
    const collections = await fetchCollections(apiUrl)
    return collections[0] || null
  } catch (error) {
    console.error('Error getting first collection:', error)
    return null
  }
}

export const fetchCollections = async (apiUrl: string): Promise<ApiCollection[]> => {
  try {
    const { url, isThreeDBagAPI } = get3DBagUrl(apiUrl, 'collections')
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      ...(!isThreeDBagAPI && { mode: 'cors' }),
    })

    if (!response.ok) throw new Error('Failed to fetch collections')

    const data = await response.json()
    const collections = data?.collections || []

    return collections
      .filter((c: any) => c?.itemType?.toLowerCase() === 'feature')
      .map((collection: any) => ({
        id: collection?.id || 'unknown-id',
        title: collection?.title || collection?.id || 'Untitled Collection',
        description: collection?.description || 'No description available',
        itemType: collection?.itemType || 'unknown',
        links: collection?.links || [],
        extent: collection?.extent || undefined,
      }))
  } catch (error) {
    console.error('Error fetching collections:', error)
    throw error // Re-throw to be handled by the caller
  }
}

export const fetchAPIInfo = async (apiUrl: string): Promise<any> => {
  const { url, isThreeDBagAPI } = get3DBagUrl(apiUrl, '')
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    ...(!isThreeDBagAPI && { mode: 'cors' }),
  })
  if (!response.ok) throw new Error('Failed to fetch API info')
  return response.json()
}
