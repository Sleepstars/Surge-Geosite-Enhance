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

  const searchFieldId = React.useId()
  const versionSelectId = React.useId()

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
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>GeoIP · 规则列表</CardTitle>
          <CardDescription>
            按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* 搜索和过滤输入占位 */}
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="h-12 rounded-md border bg-muted/20 flex-1 min-w-[240px]" />
            <div className="h-12 rounded-md border bg-muted/20 md:w-[220px]" />
          </div>

          {/* 列表容器占据剩余空间，保持卡片高度一致 */}
          <div className="border rounded-md bg-background/50 flex-1 min-h-[28rem] max-h-[28rem] flex items-center justify-center">
            <LoadingState>加载规则列表...</LoadingState>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>GeoIP · 规则列表</CardTitle>
          <CardDescription>
            按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* 搜索和过滤输入占位 */}
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="h-12 rounded-md border bg-muted/20 flex-1 min-w-[240px]" />
            <div className="h-12 rounded-md border bg-muted/20 md:w-[220px]" />
          </div>

          {/* 列表容器占据剩余空间，保持卡片高度一致 */}
          <div className="border rounded-md bg-background/50 flex-1 min-h-[28rem] max-h-[28rem] flex items-center justify-center">
            <ErrorState
              error={error instanceof Error ? error.message : '加载失败'}
              onRetry={() => refetch()}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>GeoIP · 规则列表</CardTitle>
        <CardDescription>
          按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor={searchFieldId} className="sr-only">
              搜索关键字
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id={searchFieldId}
                placeholder="输入关键字，例如 CN、APPLE"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
          </div>
          <div className="md:w-[220px]">
            <label htmlFor={versionSelectId} className="sr-only">
              IP 版本筛选
            </label>
            <Select
              id={versionSelectId}
              value={geoipVersionFilter}
              onChange={(e) => setGeoipVersionFilter(e.target.value as 'both' | 'ipv4' | 'ipv6')}
              className="h-12 text-base"
            >
              <option value="both">IPv4 + IPv6</option>
              <option value="ipv4">仅 IPv4</option>
              <option value="ipv6">仅 IPv6</option>
            </Select>
          </div>
        </div>

        <div className="border rounded-md bg-background/50 flex-1 min-h-[28rem] max-h-[28rem] overflow-y-auto">
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
