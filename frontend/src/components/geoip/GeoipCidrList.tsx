import React, { useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Copy, Download, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { LoadingState, ErrorState } from '../ui/LoadingSpinner'
import { useGeoipDetail } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'
import { clsx } from 'clsx'

export const GeoipCidrList: React.FC = () => {
  const {
    geoipSelectedName,
    geoipVersionFilter,
    geoipCidrFilter,
    setGeoipCidrFilter
  } = useAppStore()

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [localCidrFilter, setLocalCidrFilter] = useState(geoipCidrFilter)

  const debouncedCidrFilter = useDebounce(localCidrFilter, 300)

  // 同步防抖后的值到全局状态
  React.useEffect(() => {
    setGeoipCidrFilter(debouncedCidrFilter)
  }, [debouncedCidrFilter, setGeoipCidrFilter])

  // 当全局状态变化时同步到本地状态（例如切换规则组时）
  React.useEffect(() => {
    setLocalCidrFilter(geoipCidrFilter)
  }, [geoipSelectedName]) // 只在选择的规则组变化时同步
  
  const { data: detail, isLoading, error, refetch } = useGeoipDetail(
    geoipSelectedName,
    geoipVersionFilter === 'both' ? undefined : geoipVersionFilter
  )

  const parentRef = React.useRef<HTMLDivElement>(null)

  const allCidrs = useMemo(() => {
    if (!detail) return []
    
    const cidrs: Array<{ cidr: string; version: 'ipv4' | 'ipv6' }> = []
    
    if (geoipVersionFilter !== 'ipv6') {
      detail.cidr4.forEach(cidr => cidrs.push({ cidr, version: 'ipv4' }))
    }
    
    if (geoipVersionFilter !== 'ipv4') {
      detail.cidr6.forEach(cidr => cidrs.push({ cidr, version: 'ipv6' }))
    }
    
    return cidrs
  }, [detail, geoipVersionFilter])

  const filteredCidrs = useMemo(() => {
    if (!debouncedCidrFilter) return allCidrs

    const filterLower = debouncedCidrFilter.toLowerCase()
    return allCidrs.filter(({ cidr }) =>
      cidr.toLowerCase().includes(filterLower)
    )
  }, [allCidrs, debouncedCidrFilter])

  const virtualizer = useVirtualizer({
    count: filteredCidrs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
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

  if (!geoipSelectedName) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CIDR 列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            请选择规则组以查看 CIDR
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CIDR 列表</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState>加载 CIDR 列表...</LoadingState>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CIDR 列表</CardTitle>
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
          <span>CIDR 列表</span>
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
            显示 {filteredCidrs.length} 条 CIDR
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>统计：</span>
          </div>
          <Badge variant="secondary">IPv4 {detail.stats.returnedV4}</Badge>
          <Badge variant="secondary">IPv6 {detail.stats.returnedV6}</Badge>
          <Badge variant="secondary">总计 {detail.stats.returnedV4 + detail.stats.returnedV6}</Badge>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">CIDR 搜索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索 CIDR 内容"
              value={localCidrFilter}
              onChange={(e) => setLocalCidrFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div 
          ref={parentRef}
          className="border rounded-md bg-background/50 h-96 overflow-auto"
        >
          {filteredCidrs.length > 0 ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = filteredCidrs[virtualItem.index]
                return (
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
                    <div 
                      className={clsx(
                        'flex items-center justify-between p-2 border-b border-border/50 last:border-b-0',
                        virtualItem.index % 2 === 0 ? 'bg-background/50' : 'bg-background/30'
                      )}
                    >
                      <span className="font-mono text-sm">{item.cidr}</span>
                      <Badge 
                        variant="outline" 
                        className={clsx(
                          'text-xs',
                          item.version === 'ipv4' 
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        )}
                      >
                        {item.version.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              没有找到匹配的 CIDR
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
