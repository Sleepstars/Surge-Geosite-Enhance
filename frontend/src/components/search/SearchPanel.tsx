import { useState } from 'react'
import { Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import { ErrorState } from '../ui/LoadingSpinner'
import { useGeositeSearch, useGeoipSearch } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'

export function SearchPanel() {
  const { activeDataset } = useAppStore()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(50)
  const [attributes, setAttributes] = useState('')
  const [version, setVersion] = useState<'both' | 'ipv4' | 'ipv6'>('both')
  
  const debouncedQuery = useDebounce(query, 300)
  
  const geositeSearch = useGeositeSearch()
  const geoipSearch = useGeoipSearch()

  const handleSearch = () => {
    if (!debouncedQuery.trim()) return

    if (activeDataset === 'geosite') {
      geositeSearch.mutate({
        query: debouncedQuery,
        limit,
        attributes: attributes || undefined,
      })
    } else {
      geoipSearch.mutate({
        query: debouncedQuery,
        limit,
        version,
      })
    }
  }

  const isLoading = geositeSearch.isPending || geoipSearch.isPending
  const error = geositeSearch.error || geoipSearch.error
  const data = activeDataset === 'geosite' ? geositeSearch.data : geoipSearch.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          反向匹配
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {activeDataset === 'geosite' ? '域名或关键字' : 'IP 地址或 CIDR'}
            </label>
            <Input
              placeholder={
                activeDataset === 'geosite' 
                  ? '例如：apple.com 或 google' 
                  : '例如：8.8.8.8 或 192.168.1.0/24'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">结果限制</label>
            <Select
              value={limit.toString()}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="20">20 条</option>
              <option value="50">50 条</option>
              <option value="100">100 条</option>
              <option value="200">200 条</option>
            </Select>
          </div>
        </div>

        {activeDataset === 'geosite' ? (
          <div>
            <label className="block text-sm font-medium mb-2">属性过滤</label>
            <Input
              placeholder="例如：cn 或 !cn"
              value={attributes}
              onChange={(e) => setAttributes(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2">IP 版本</label>
            <Select
              value={version}
              onChange={(e) => setVersion(e.target.value as 'both' | 'ipv4' | 'ipv6')}
            >
              <option value="both">IPv4 + IPv6</option>
              <option value="ipv4">仅 IPv4</option>
              <option value="ipv6">仅 IPv6</option>
            </Select>
          </div>
        )}

        <Button 
          onClick={handleSearch} 
          disabled={!debouncedQuery.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? '搜索中...' : '开始匹配'}
        </Button>

        {error && (
          <ErrorState 
            error={error instanceof Error ? error.message : '搜索失败'} 
            onRetry={handleSearch}
          />
        )}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>找到 {data.matches.length} 条结果</span>
              <span>·</span>
              <span>扫描了 {data.scope.scanned} 个列表</span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.matches.map((match, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-md bg-background/50 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{match.list}</Badge>
                        {'reason' in match && (
                          <Badge variant="secondary" className="text-xs">
                            {match.reason}
                          </Badge>
                        )}
                      </div>
                      
                      {'rule' in match ? (
                        <div className="font-mono text-sm break-all">
                          {match.rule.value}
                        </div>
                      ) : (
                        <div className="font-mono text-sm break-all">
                          {match.cidr}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      分数: {match.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
