import type { CityJSONDocument, CityJSONFeature, LocalCollection } from '@/types/cityjson'

interface ProcessFileOptions {
  onProgress?: (progress: number) => void
  onValidationError?: (error: Error) => void
  validateOnly?: boolean
}

interface ProcessFileResult {
  base: CityJSONDocument
  features: CityJSONFeature[]
}

export const isValidCityJSONSeqFile = (file: File): boolean => {
  return file.name.toLowerCase().endsWith('.city.jsonl')
}

export const normalizeCRS = (crs: string | null | undefined): string | null => {
  if (!crs) return null
  const epsgMatch = crs.match(/EPSG[:/](\d+)/i)
  return epsgMatch ? `EPSG:${epsgMatch[1]}` : crs
}

export const isCRSCompatible = (
  existingCRS: string | null | undefined,
  newCRS: string | null | undefined,
): boolean => {
  if (!existingCRS || !newCRS) return false
  return normalizeCRS(existingCRS) === normalizeCRS(newCRS)
}

export const hasIDConflicts = (
  existingFeatures: CityJSONFeature[],
  newFeatures: CityJSONFeature[],
): boolean => {
  const existingIds = new Set(existingFeatures.map((f) => f.id))
  return newFeatures.some((f) => existingIds.has(f.id))
}

export const processFileStream = async (
  file: File,
  options: ProcessFileOptions = {},
): Promise<ProcessFileResult> => {
  const { onProgress = () => {}, validateOnly = false } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const features: CityJSONFeature[] = []
    let base: CityJSONDocument | null = null
    let lineNumber = 0

    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        if (!event.target?.result || typeof event.target.result !== 'string') {
          throw new Error('Could not read file content as text.')
        }

        const text = event.target.result
        const lines = text.split('\n').filter((line) => line.trim())
        if (lines.length === 0) throw new Error('File is empty')

        try {
          base = JSON.parse(lines[0]) as CityJSONDocument
          if (!base.metadata?.referenceSystem) {
            throw new Error('Invalid base CityJSON object: missing metadata.referenceSystem')
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          throw new Error(`Invalid base CityJSON object on line 1: ${message}`)
        }

        for (let i = 1; i < lines.length; i++) {
          lineNumber = i + 1
          try {
            const feature = JSON.parse(lines[i]) as CityJSONFeature
            if (!feature.id) {
              throw new Error(`Feature missing ID on line ${lineNumber}`)
            }
            if (!validateOnly) {
              features.push(feature)
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            throw new Error(`Invalid CityJSON feature on line ${lineNumber}: ${message}`)
          }
          onProgress((i / (lines.length - 1)) * 100)
        }

        resolve({ base: base!, features })
      } catch (error: unknown) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsText(file)
  })
}

export const mergeData = (
  existingBase: CityJSONDocument,
  existingFeatures: CityJSONFeature[],
  newBase: CityJSONDocument,
  newFeatures: CityJSONFeature[],
): ProcessFileResult => {
  if (!isCRSCompatible(existingBase.metadata?.referenceSystem, newBase.metadata?.referenceSystem)) {
    throw new Error('Incompatible coordinate reference systems')
  }
  if (hasIDConflicts(existingFeatures, newFeatures)) {
    throw new Error('Feature ID conflicts detected')
  }
  return {
    base: existingBase,
    features: [...existingFeatures, ...newFeatures],
  }
}

export const createCollectionFromFile = (
  file: File,
  base: CityJSONDocument,
  features: CityJSONFeature[],
): LocalCollection => {
  const timestamp = new Date().toISOString()
  const fileName = file.name.replace('.city.jsonl', '')

  return {
    id: `file_${fileName}_${timestamp}`,
    title: fileName,
    description: `Loaded from file: ${file.name} on ${new Date().toLocaleString()}`,
    itemType: 'Feature',
    extent: {
      spatial: {
        bbox: base.metadata?.geographicalExtent || null,
        crs: base.metadata?.referenceSystem || null,
      },
      temporal: {
        interval: null,
      },
    },
  }
}
