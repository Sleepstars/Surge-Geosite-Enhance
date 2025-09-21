import React, { useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Copy, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { LoadingState, ErrorState, LoadingSpinner } from '../ui/LoadingSpinner'
import { GeositeRuleItem } from './GeositeRuleItem'
import { useGeositeDetail } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'
import type { GeositeDetail } from '@/types'

const API_INPUT_DEBOUNCE = 500

export const GeositeRuleList: React.FC = () => {
  const {
    geositeSelectedName,
    geositeAttributeFilter,
    setGeositeAttributeFilter,
    geositeRuleFilter,
    setGeositeRuleFilter
  } = useAppStore()

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [srsCopyStatus, setSrsCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [localRuleFilter, setLocalRuleFilter] = useState(geositeRuleFilter)
  const [localAttributeFilter, setLocalAttributeFilter] = useState(geositeAttributeFilter)
  const [cachedDetail, setCachedDetail] = useState<GeositeDetail | null>(null)
  const lastSelectedNameRef = React.useRef<string | null>(null)

  // 使用防抖来避免频繁的API请求
  const debouncedRuleFilter = useDebounce(localRuleFilter, API_INPUT_DEBOUNCE)
  const debouncedAttributeFilter = useDebounce(localAttributeFilter, API_INPUT_DEBOUNCE)

  // 同步防抖后的值到全局状态
  React.useEffect(() => {
    setGeositeRuleFilter(debouncedRuleFilter)
  }, [debouncedRuleFilter, setGeositeRuleFilter])

  React.useEffect(() => {
    setGeositeAttributeFilter(debouncedAttributeFilter)
  }, [debouncedAttributeFilter, setGeositeAttributeFilter])

  // 当全局状态变化时同步到本地状态（例如切换规则组时）
  React.useEffect(() => {
    setLocalRuleFilter(geositeRuleFilter)
    setLocalAttributeFilter(geositeAttributeFilter)
  }, [geositeSelectedName]) // 只在选择的规则组变化时同步

  const { data: detail, isPending, isFetching, error, refetch } = useGeositeDetail(
    geositeSelectedName,
    {
      limit: 2000, // Load more rules for better UX
      search: debouncedRuleFilter, // 使用防抖后的值
      filter: debouncedAttributeFilter, // 使用防抖后的值
    }
  )

  React.useEffect(() => {
    if (detail) {
      setCachedDetail(detail)
    }
  }, [detail])

  React.useEffect(() => {
    if (!geositeSelectedName) {
      setCachedDetail(null)
      lastSelectedNameRef.current = null
      return
    }

    if (lastSelectedNameRef.current !== geositeSelectedName) {
      setCachedDetail(null)
      lastSelectedNameRef.current = geositeSelectedName
    }
  }, [geositeSelectedName])

  const parentRef = React.useRef<HTMLDivElement>(null)

  const activeDetail = detail ?? cachedDetail
  const filteredRules = useMemo(() => {
    if (!activeDetail?.rules) return []
    return activeDetail.rules
  }, [activeDetail])

  const srsUrl = useMemo(() => {
    if (!activeDetail?.url) return null
    const filterSuffix = activeDetail.filters.length > 0 ? `@${activeDetail.filters.join(',')}` : ''
    const nameWithFilter = `${activeDetail.name}${filterSuffix}`

    try {
      const url = new URL(activeDetail.url)
      return `${url.origin}/srs-geosite/${nameWithFilter}.srs`
    } catch {
      if (activeDetail.url.includes('/geosite/')) {
        return `${activeDetail.url.replace('/geosite/', '/srs-geosite/')}${filterSuffix}.srs`
      }
      return null
    }
  }, [activeDetail])

  const virtualizer = useVirtualizer({
    count: filteredRules.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  })

  const handleCopyUrl = async () => {
    if (!activeDetail?.url) return
    
    try {
      await navigator.clipboard.writeText(activeDetail.url)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleCopySrsUrl = async () => {
    if (!srsUrl) return

    try {
      await navigator.clipboard.writeText(srsUrl)
      setSrsCopyStatus('copied')
      setTimeout(() => setSrsCopyStatus('idle'), 2000)
    } catch {
      setSrsCopyStatus('error')
      setTimeout(() => setSrsCopyStatus('idle'), 2000)
    }
  }

  const isInitialLoading = isPending && !activeDetail
  const isBackgroundFetching = isFetching && !!activeDetail

  if (!geositeSelectedName) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>规则详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            请选择规则组以查看详情
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>规则详情</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState>加载规则详情...</LoadingState>
        </CardContent>
      </Card>
    )
  }

  if (error && !activeDetail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>规则详情</CardTitle>
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

  if (!activeDetail) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            规则详情
            {isBackgroundFetching && <LoadingSpinner size="sm" className="text-muted-foreground" />}
          </span>
          <div className="flex items-center gap-2">
            {activeDetail.url && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copyStatus === 'copied' ? '已复制' : copyStatus === 'error' ? '复制失败' : 'Surge 规则'}
                </Button>
                {srsUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySrsUrl}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {srsCopyStatus === 'copied'
                      ? '已复制'
                      : srsCopyStatus === 'error'
                        ? '复制失败'
                        : 'SRS 规则'}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && activeDetail && (
          <ErrorState 
            error={error instanceof Error ? error.message : '加载失败'} 
            onRetry={() => refetch()}
            className="border border-destructive/20 rounded-md"
          />
        )}

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">{activeDetail.name}</Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            共 {activeDetail.stats.filtered.total} 条规则
          </span>
          {activeDetail.stats.overall.total !== activeDetail.stats.filtered.total && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                (原始 {activeDetail.stats.overall.total} 条)
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">属性过滤</label>
            <Input
              placeholder="如 cn 或 !cn，留空为全部"
              value={localAttributeFilter}
              onChange={(e) => setLocalAttributeFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">规则搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索规则内容"
                value={localRuleFilter}
                onChange={(e) => setLocalRuleFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>统计：</span>
          </div>
          <Badge variant="secondary">域名后缀 {activeDetail.stats.filtered.domain}</Badge>
          <Badge variant="secondary">完整域名 {activeDetail.stats.filtered.full}</Badge>
          <Badge variant="secondary">正则 {activeDetail.stats.filtered.regexp}</Badge>
        </div>

        <div 
          ref={parentRef}
          className="relative border rounded-md bg-background/50 h-96 overflow-auto"
        >
          {filteredRules.length > 0 ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <GeositeRuleItem
                    rule={filteredRules[virtualItem.index]}
                    index={virtualItem.index}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              没有找到匹配的规则
            </div>
          )}
          {isBackgroundFetching && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <LoadingSpinner className="text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
