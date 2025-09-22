import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { LoadingState, ErrorState } from '../ui/LoadingSpinner'
import { useGeoipIndex } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'
import { clsx } from 'clsx'

export const GeoipNameList: React.FC = () => {
  const { data: index, isLoading, error, refetch } = useGeoipIndex()
  const {
    geoipSearch,
    setGeoipSearch,
    geoipVersionFilter,
    setGeoipVersionFilter,
    geoipSelectedName,
    setGeoipSelectedName
  } = useAppStore()

  const [localSearch, setLocalSearch] = useState(geoipSearch)
  const debouncedSearch = useDebounce(localSearch, 300)

  // 同步防抖后的值到全局状态
  React.useEffect(() => {
    setGeoipSearch(debouncedSearch)
  }, [debouncedSearch, setGeoipSearch])

  // 当全局状态变化时同步到本地状态
  React.useEffect(() => {
    setLocalSearch(geoipSearch)
  }, [geoipSearch])

  const filteredNames = useMemo(() => {
    if (!index) return []

    const names = Object.keys(index).sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    )

    if (!debouncedSearch) return names

    const searchLower = debouncedSearch.toLowerCase()
    return names.filter(name =>
      name.toLowerCase().includes(searchLower)
    )
  }, [index, debouncedSearch])

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>GeoIP · 规则列表</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState>加载规则列表...</LoadingState>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>GeoIP · 规则列表</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState 
            error={error instanceof Error ? error.message : '加载失败'} 
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>GeoIP · 规则列表</CardTitle>
        <CardDescription>
          按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 flex flex-col h-full">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="输入关键字，例如 CN、APPLE"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={geoipVersionFilter}
            onChange={(e) => setGeoipVersionFilter(e.target.value as 'both' | 'ipv4' | 'ipv6')}
            className="w-40"
          >
            <option value="both">IPv4 + IPv6</option>
            <option value="ipv4">仅 IPv4</option>
            <option value="ipv6">仅 IPv6</option>
          </Select>
        </div>
        
        <div className="border rounded-md bg-background/50 flex-1 min-h-[24rem] overflow-y-auto">
          {filteredNames.length > 0 ? (
            <div className="p-2">
              {filteredNames.map((name) => (
                <div
                  key={name}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors',
                    'hover:bg-accent/50',
                    geoipSelectedName === name && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => setGeoipSelectedName(name)}
                >
                  <span className="font-medium">{name}</span>
                  {index && index[name] && (
                    <span className="text-xs text-muted-foreground">
                      {index[name]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {geoipSearch ? '没有找到匹配的规则' : '暂无数据'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
