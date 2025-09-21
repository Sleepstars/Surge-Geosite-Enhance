import React, { useMemo } from 'react'
import { Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { LoadingState, ErrorState } from '../ui/LoadingSpinner'
import { useGeoipIndex } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
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

  const filteredNames = useMemo(() => {
    if (!index) return []
    
    const names = Object.keys(index).sort((a, b) => 
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    )
    
    if (!geoipSearch) return names
    
    const searchLower = geoipSearch.toLowerCase()
    return names.filter(name => 
      name.toLowerCase().includes(searchLower)
    )
  }, [index, geoipSearch])

  if (isLoading) {
    return (
      <Card>
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
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle>GeoIP · 规则列表</CardTitle>
        <CardDescription>
          按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">名称搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="输入关键字，例如 CN、APPLE"
                value={geoipSearch}
                onChange={(e) => setGeoipSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">显示类型</label>
            <Select
              value={geoipVersionFilter}
              onChange={(e) => setGeoipVersionFilter(e.target.value as 'both' | 'ipv4' | 'ipv6')}
            >
              <option value="both">IPv4 + IPv6</option>
              <option value="ipv4">仅 IPv4</option>
              <option value="ipv6">仅 IPv6</option>
            </Select>
          </div>
        </div>
        
        <div className="border rounded-md bg-background/50 max-h-96 overflow-y-auto">
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
