import React, { useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Copy, Download, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { LoadingState, ErrorState } from '../ui/LoadingSpinner'
import { GeositeRuleItem } from './GeositeRuleItem'
import { useGeositeDetail } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'

export const GeositeRuleList: React.FC = () => {
  const {
    geositeSelectedName,
    geositeAttributeFilter,
    setGeositeAttributeFilter,
    geositeRuleFilter,
    setGeositeRuleFilter
  } = useAppStore()

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [localRuleFilter, setLocalRuleFilter] = useState(geositeRuleFilter)
  const [localAttributeFilter, setLocalAttributeFilter] = useState(geositeAttributeFilter)

  // 使用防抖来避免频繁的API请求
  const debouncedRuleFilter = useDebounce(localRuleFilter, 300)
  const debouncedAttributeFilter = useDebounce(localAttributeFilter, 300)

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

  const { data: detail, isLoading, error, refetch } = useGeositeDetail(
    geositeSelectedName,
    {
      limit: 2000, // Load more rules for better UX
      search: debouncedRuleFilter, // 使用防抖后的值
      filter: debouncedAttributeFilter, // 使用防抖后的值
    }
  )

  const parentRef = React.useRef<HTMLDivElement>(null)

  const filteredRules = useMemo(() => {
    if (!detail?.rules) return []
    return detail.rules
  }, [detail?.rules])

  const virtualizer = useVirtualizer({
    count: filteredRules.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  })

  const handleCopyUrl = async () => {
    if (!detail?.url) return
    
    try {
      await navigator.clipboard.writeText(detail.url)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

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

  if (isLoading) {
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

  if (error) {
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

  if (!detail) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>规则详情</span>
          <div className="flex items-center gap-2">
            {detail.url && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copyStatus === 'copied' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制链接'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={detail.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    下载
                  </a>
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">{detail.name}</Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            共 {detail.stats.filtered.total} 条规则
          </span>
          {detail.stats.overall.total !== detail.stats.filtered.total && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                (原始 {detail.stats.overall.total} 条)
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
          <Badge variant="secondary">域名后缀 {detail.stats.filtered.domain}</Badge>
          <Badge variant="secondary">完整域名 {detail.stats.filtered.full}</Badge>
          <Badge variant="secondary">正则 {detail.stats.filtered.regexp}</Badge>
        </div>

        <div 
          ref={parentRef}
          className="border rounded-md bg-background/50 h-96 overflow-auto"
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
        </div>
      </CardContent>
    </Card>
  )
}
