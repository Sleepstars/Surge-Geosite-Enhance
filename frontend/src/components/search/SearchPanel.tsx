import { useState } from 'react'
import { Search, Zap, HelpCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import { ErrorState } from '../ui/LoadingSpinner'
import { useGeositeSearch, useGeositeFastSearch, useGeoipSearch } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'

const API_INPUT_DEBOUNCE = 500

export function SearchPanel() {
  const { activeDataset } = useAppStore()
  const [fastQuery, setFastQuery] = useState('')
  const [comprehensiveQuery, setComprehensiveQuery] = useState('')
  const [attributes, setAttributes] = useState('')
  const [version, setVersion] = useState<'both' | 'ipv4' | 'ipv6'>('both')

  const debouncedFastQuery = useDebounce(fastQuery, API_INPUT_DEBOUNCE)
  const debouncedComprehensiveQuery = useDebounce(comprehensiveQuery, API_INPUT_DEBOUNCE)

  const geositeSearch = useGeositeSearch()
  const geositeFastSearch = useGeositeFastSearch()
  const geoipSearch = useGeoipSearch()

  const handleFastSearch = () => {
    if (!debouncedFastQuery.trim()) return

    if (activeDataset === 'geosite') {
      geositeFastSearch.mutate({
        query: debouncedFastQuery,
        attributes: attributes || undefined,
      })
    } else {
      geoipSearch.mutate({
        query: debouncedFastQuery,
        version,
      })
    }
  }

  const handleComprehensiveSearch = () => {
    if (!debouncedComprehensiveQuery.trim()) return

    if (activeDataset === 'geosite') {
      geositeSearch.mutate({
        query: debouncedComprehensiveQuery,
        attributes: attributes || undefined,
      })
    } else {
      geoipSearch.mutate({
        query: debouncedComprehensiveQuery,
        version,
      })
    }
  }

  const isLoading = geositeSearch.isPending || geositeFastSearch.isPending || geoipSearch.isPending
  const latestGeositeFirst = (geositeFastSearch.submittedAt ?? 0) >= (geositeSearch.submittedAt ?? 0)
  const geositeData = latestGeositeFirst ? geositeFastSearch.data : geositeSearch.data
  const geositeError = latestGeositeFirst ? geositeFastSearch.error : geositeSearch.error
  const error = activeDataset === 'geosite' ? geositeError : geoipSearch.error
  const data = activeDataset === 'geosite' ? geositeData : geoipSearch.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          反向匹配
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {activeDataset === 'geosite' ? (
          <div className="space-y-4">
            {/* Fast Search Section */}
            <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-green-600" />
                <label className="text-sm font-medium text-green-800 dark:text-green-200">
                  快速搜索 (后缀匹配)
                </label>
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-green-600 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    仅匹配域名后缀，速度更快，适合精确域名查询
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-nowrap">
                <Input
                  placeholder="例如：apple.com"
                  value={fastQuery}
                  onChange={(e) => setFastQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFastSearch()}
                  className="flex-1 min-w-[220px]"
                />
                {/* 属性过滤与搜索操作放在同一行 */}
                <Input
                  placeholder="属性过滤（如 cn 或 !cn）"
                  value={attributes}
                  onChange={(e) => setAttributes(e.target.value)}
                  className="w-full sm:w-48 md:w-52 sm:flex-none"
                />
                <Button
                  onClick={handleFastSearch}
                  disabled={!debouncedFastQuery.trim() || isLoading}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto sm:flex-none"
                  aria-label="快速匹配"
                  title="快速匹配"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="w-4 h-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              {fastQuery && !fastQuery.includes('.') && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ 快速搜索建议输入完整域名以获得最佳效果
                </div>
              )}
            </div>

            {/* Comprehensive Search Section */}
            <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-blue-600" />
                <label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  全面搜索 (模糊匹配)
                </label>
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-blue-600 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    支持部分匹配和关键字搜索，功能更全面
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-nowrap">
                <Input
                  placeholder="例如：google 或 apple.com"
                  value={comprehensiveQuery}
                  onChange={(e) => setComprehensiveQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleComprehensiveSearch()}
                  className="flex-1 min-w-[220px]"
                />
                {/* 属性过滤与搜索操作放在同一行 */}
                <Input
                  placeholder="属性过滤（如 cn 或 !cn）"
                  value={attributes}
                  onChange={(e) => setAttributes(e.target.value)}
                  className="w-full sm:w-48 md:w-52 sm:flex-none"
                />
                <Button
                  onClick={handleComprehensiveSearch}
                  disabled={!debouncedComprehensiveQuery.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto sm:flex-none"
                  aria-label="全面搜索"
                  title="全面搜索"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="w-4 h-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium">IP 匹配</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-nowrap">
              <Input
                placeholder="例如：8.8.8.8 或 192.168.1.0/24"
                value={comprehensiveQuery}
                onChange={(e) => setComprehensiveQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleComprehensiveSearch()}
                className="flex-1 min-w-[220px]"
              />
              {/* IP 版本与搜索操作放在同一行 */}
              <Select
                value={version}
                onChange={(e) => setVersion(e.target.value as 'both' | 'ipv4' | 'ipv6')}
                className="w-full sm:w-32 md:w-40 sm:flex-none"
              >
                <option value="both">IPv4 + IPv6</option>
                <option value="ipv4">仅 IPv4</option>
                <option value="ipv6">仅 IPv6</option>
              </Select>
              <Button
                onClick={handleComprehensiveSearch}
                disabled={!debouncedComprehensiveQuery.trim() || isLoading}
                className="w-full sm:w-auto sm:flex-none"
                aria-label="开始匹配"
                title="开始匹配"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="w-4 h-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        )}


        {error && (
          <ErrorState
            error={error instanceof Error ? error.message : '搜索失败'}
            onRetry={() => {
              if (fastQuery.trim()) handleFastSearch()
              else if (comprehensiveQuery.trim()) handleComprehensiveSearch()
            }}
          />
        )}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>找到 {data.matches.length} 条结果</span>
              <span>·</span>
              <span>扫描了 {data.scope.scanned} 个列表</span>
              {data.searchMode && (
                <>
                  <span>·</span>
                  <Badge variant={data.searchMode === 'fast-suffix' ? 'default' : 'secondary'} className="text-xs">
                    {data.searchMode === 'fast-suffix' ? '快速搜索' :
                     data.searchMode === 'comprehensive' ? '全面搜索' : data.searchMode}
                  </Badge>
                </>
              )}
              {data.performance && (
                <>
                  <span>·</span>
                  <span className="text-green-600 dark:text-green-400">
                    {data.performance.searchTimeMs}ms
                  </span>
                </>
              )}
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
