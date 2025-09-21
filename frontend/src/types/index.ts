export interface RuleItem {
  type: 'domain' | 'full' | 'keyword' | 'regexp'
  value: string
  attrs?: string[]
}

export interface GeositeDetail {
  name: string
  requested: string
  url?: string
  segments: string[]
  filters: string[]
  search: string
  pagination: {
    offset: number
    limit: number
    total: number
    hasMore: boolean
    returned: number
  }
  stats: {
    overall: RuleStats
    filtered: RuleStats
  }
  attributes: string[]
  rules: RuleItem[]
}

export interface RuleStats {
  total: number
  domain: number
  full: number
  keyword: number
  regexp: number
}

export interface GeoipDetail {
  name: string
  requested: string
  url?: string
  segments: string[]
  filter?: string
  stats: {
    totalV4: number
    totalV6: number
    returnedV4: number
    returnedV6: number
  }
  cidr4: string[]
  cidr6: string[]
}

export interface GeositeSearchMatch {
  list: string
  url?: string
  rule: RuleItem
  reason: string
  score: number
  matched: string
}

export interface GeoipSearchMatch {
  list: string
  url?: string
  version: 'ipv4' | 'ipv6'
  cidr: string
  prefix: number
  score: number
}

export interface SearchResponse<T> {
  query: string
  limit: number
  scope: {
    requested: string[]
    used: number
    total: number
    scanned: number
    prioritized: string[]
  }
  matches: T[]
}

export interface GeositeSearchResponse extends SearchResponse<GeositeSearchMatch> {
  filters: string[]
}

export interface GeoipSearchResponse extends SearchResponse<GeoipSearchMatch> {
  version: 'ipv4' | 'ipv6' | 'both'
  mode: string
}

export type Dataset = 'geosite' | 'geoip'

export interface TreeNode {
  label: string
  path: string
  fullName?: string
  children: Map<string, TreeNode>
}
