import { useQuery, useMutation } from '@tanstack/react-query'
import {
  GeositeDetail,
  GeoipDetail,
  GeositeSearchResponse,
  GeoipSearchResponse,
} from '@/types'

const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : configuredApiBase

// Unified response handler to surface better errors (e.g., 429)
const handleJson = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>

  let message = defaultError
  if (response.status === 429) {
    const ra = response.headers.get('retry-after')
    if (ra && /^\d+$/.test(ra)) {
      message = `操作过于频繁，请在 ${ra} 秒后再试`
    } else {
      message = '操作过于频繁，请稍后再试'
    }
  } else {
    try {
      // Try to read JSON error payload if available
      const data = (await response.clone().json()) as { message?: string } | undefined
      if (data && typeof data.message === 'string' && data.message.trim()) {
        message = data.message
      }
    } catch {
      try {
        const text = await response.text()
        if (text && text.length < 200) message = text
      } catch {}
    }
  }

  throw new Error(message)
}

// Fetch functions
const fetchGeositeIndex = async (): Promise<Record<string, string>> => {
  const response = await fetch(`${API_BASE}/geosite`)
  return handleJson<Record<string, string>>(response, '获取 Geosite 索引失败')
}

const fetchGeoipIndex = async (): Promise<Record<string, string>> => {
  const response = await fetch(`${API_BASE}/geoip`)
  return handleJson<Record<string, string>>(response, '获取 GeoIP 索引失败')
}

const fetchGeositeDetail = async (
  name: string, 
  options: {
    offset?: number
    limit?: number
    search?: string
    filter?: string
  } = {}
): Promise<GeositeDetail> => {
  const params = new URLSearchParams()
  if (options.offset !== undefined) params.set('offset', options.offset.toString())
  if (options.limit !== undefined) params.set('limit', options.limit.toString())
  if (options.search) params.set('search', options.search)
  if (options.filter) params.set('filter', options.filter)
  
  const response = await fetch(`${API_BASE}/api/geosite/${name}?${params}`)
  return handleJson<GeositeDetail>(response, '获取 Geosite 详情失败')
}

const fetchGeoipDetail = async (
  name: string, 
  filter?: string
): Promise<GeoipDetail> => {
  const params = new URLSearchParams()
  if (filter) params.set('filter', filter)
  
  const response = await fetch(`${API_BASE}/api/geoip/${name}?${params}`)
  return handleJson<GeoipDetail>(response, '获取 GeoIP 详情失败')
}

const searchGeosite = async (payload: {
  query: string
  attributes?: string
  names?: string[]
  limit?: number
  lists?: number
}): Promise<GeositeSearchResponse> => {
  const response = await fetch(`${API_BASE}/api/search/geosite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleJson<GeositeSearchResponse>(response, '搜索 Geosite 失败')
}

const searchGeositeFast = async (payload: {
  query: string
  attributes?: string
  names?: string[]
  limit?: number
  lists?: number
}): Promise<GeositeSearchResponse> => {
  const response = await fetch(`${API_BASE}/api/search/geosite/fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleJson<GeositeSearchResponse>(response, '搜索 Geosite（快速）失败')
}

const searchGeoip = async (payload: {
  query: string
  version?: 'ipv4' | 'ipv6' | 'both'
  names?: string[]
  limit?: number
  lists?: number
}): Promise<GeoipSearchResponse> => {
  const response = await fetch(`${API_BASE}/api/search/geoip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleJson<GeoipSearchResponse>(response, '搜索 GeoIP 失败')
}

// Hooks
export const useGeositeIndex = () => {
  return useQuery({
    queryKey: ['geosite', 'index'],
    queryFn: fetchGeositeIndex,
  })
}

export const useGeoipIndex = () => {
  return useQuery({
    queryKey: ['geoip', 'index'],
    queryFn: fetchGeoipIndex,
  })
}

export const useGeositeDetail = (
  name: string, 
  options: {
    offset?: number
    limit?: number
    search?: string
    filter?: string
  } = {}
) => {
  return useQuery({
    queryKey: ['geosite', 'detail', name, options],
    queryFn: () => fetchGeositeDetail(name, options),
    enabled: !!name,
  })
}

export const useGeoipDetail = (name: string, filter?: string) => {
  return useQuery({
    queryKey: ['geoip', 'detail', name, filter],
    queryFn: () => fetchGeoipDetail(name, filter),
    enabled: !!name,
  })
}

export const useGeositeSearch = () => {
  return useMutation({
    mutationFn: searchGeosite,
  })
}

export const useGeositeFastSearch = () => {
  return useMutation({
    mutationFn: searchGeositeFast,
  })
}

export const useGeoipSearch = () => {
  return useMutation({
    mutationFn: searchGeoip,
  })
}
