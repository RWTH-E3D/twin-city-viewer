import proj4 from 'proj4'

const EXPLICIT_DEFS: Record<string, string> = {
  '4326': '+proj=longlat +datum=WGS84 +no_defs',
  '4258': '+proj=longlat +ellps=GRS80 +no_defs',
  '3857':
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  '28992':
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
  '7415':
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +vunits=m +no_defs',
}

const DHHN_UTM_ZONES: Record<string, number> = {
  '5554': 31,
  '5555': 32,
  '5556': 33,
}

const utmDef = (zone: number, south: boolean, ellps: string): string =>
  `+proj=utm +zone=${zone}${south ? ' +south' : ''} +${ellps} +units=m +no_defs`

const gaussKruegerDef = (zone: number): string =>
  `+proj=tmerc +lat_0=0 +lon_0=${zone * 3} +k=1 +x_0=${zone}500000 +y_0=0 +ellps=bessel ` +
  '+towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs'

const buildProjectionDefinition = (code: string): string | null => {
  if (EXPLICIT_DEFS[code]) return EXPLICIT_DEFS[code]

  const numeric = Number(code)
  if (!Number.isFinite(numeric)) return null

  // ETRS89 / UTM zone 28N..38N
  if (numeric >= 25828 && numeric <= 25838) return utmDef(numeric - 25800, false, 'ellps=GRS80')
  // WGS84 / UTM zone 1N..60N and 1S..60S
  if (numeric >= 32601 && numeric <= 32660) return utmDef(numeric - 32600, false, 'datum=WGS84')
  if (numeric >= 32701 && numeric <= 32760) return utmDef(numeric - 32700, true, 'datum=WGS84')
  // ETRS89 / UTM zone N + German height system
  if (DHHN_UTM_ZONES[code]) return utmDef(DHHN_UTM_ZONES[code], false, 'ellps=GRS80')
  // DHDN / 3-degree Gauss-Krueger zone 2..5
  if (numeric >= 31466 && numeric <= 31469) return gaussKruegerDef(numeric - 31464)

  return null
}

export const normalizeEpsg = (code: string): string =>
  code.trim().toUpperCase().startsWith('EPSG:') ? code.trim().slice(5) : code.trim()

export const getProjectionDefinition = (epsgCode: string): string | null =>
  buildProjectionDefinition(normalizeEpsg(epsgCode))

export const isWgs84 = (epsgCode: string): boolean => normalizeEpsg(epsgCode) === '4326'

const converterCache = new Map<string, proj4.Converter>()

export const getConverter = (fromEPSG: string, toEPSG: string): proj4.Converter => {
  const from = normalizeEpsg(fromEPSG)
  const to = normalizeEpsg(toEPSG)
  const key = `${from}->${to}`

  const cached = converterCache.get(key)
  if (cached) return cached

  const fromDef = getProjectionDefinition(from)
  const toDef = getProjectionDefinition(to)
  if (!fromDef || !toDef) {
    throw new Error(`Could not find definition for EPSG:${!fromDef ? from : to}`)
  }

  const converter = proj4(fromDef, toDef)
  converterCache.set(key, converter)
  return converter
}
