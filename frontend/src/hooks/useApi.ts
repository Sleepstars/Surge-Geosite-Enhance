import { useQuery, useMutation } from '@tanstack/react-query'
import { 
  GeositeDetail, 
  GeoipDetail, 
  GeositeSearchResponse, 
  GeoipSearchResponse 
} from '@/types'

const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : configuredApiBase

// Fetch functions
const fetchGeositeIndex = async (): Promise<Record<string, string>> => {
  const response = await fetch(`${API_BASE}/geosite`)
  if (!response.ok) throw new Error('Failed to fetch geosite index')
  return response.json()
}

const fetchGeoipIndex = async (): Promise<Record<string, string>> => {
  const response = await fetch(`${API_BASE}/geoip`)
  if (!response.ok) throw new Error('Failed to fetch geoip index')
  return response.json()
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
  if (!response.ok) throw new Error('Failed to fetch geosite detail')
  return response.json()
}

const fetchGeoipDetail = async (
  name: string, 
  filter?: string
): Promise<GeoipDetail> => {
  const params = new URLSearchParams()
  if (filter) params.set('filter', filter)
  
  const response = await fetch(`${API_BASE}/api/geoip/${name}?${params}`)
  if (!response.ok) throw new Error('Failed to fetch geoip detail')
  return response.json()
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
  if (!response.ok) throw new Error('Failed to search geosite')
  return response.json()
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
  if (!response.ok) throw new Error('Failed to search geosite (fast)')
  return response.json()
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
  if (!response.ok) throw new Error('Failed to search geoip')
  return response.json()
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
