import React, { useMemo, useState } from 'react'
import { Search, Expand, Minimize } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { LoadingState, ErrorState } from '../ui/LoadingSpinner'
import { GeositeTreeNode } from './GeositeTreeNode'
import { useGeositeIndex } from '@/hooks/useApi'
import { useAppStore } from '@/stores/useAppStore'
import { useDebounce } from '@/hooks/useDebounce'
import { buildGeositeTree, filterTreeBySearch, getAllNodePaths } from '@/utils/tree'

export const GeositeTree: React.FC = () => {
  const { data: index, isLoading, error, refetch } = useGeositeIndex()
  const {
    geositeTreeSearch,
    setGeositeTreeSearch,
    geositeExpandedNodes,
    collapseAllNodes,
    toggleNodeExpansion
  } = useAppStore()

  const [localTreeSearch, setLocalTreeSearch] = useState(geositeTreeSearch)
  const debouncedTreeSearch = useDebounce(localTreeSearch, 300)

  // 同步防抖后的值到全局状态
  React.useEffect(() => {
    setGeositeTreeSearch(debouncedTreeSearch)
  }, [debouncedTreeSearch, setGeositeTreeSearch])

  // 当全局状态变化时同步到本地状态
  React.useEffect(() => {
    setLocalTreeSearch(geositeTreeSearch)
  }, [geositeTreeSearch])

  const { treeRoot, filteredRoot } = useMemo(() => {
    if (!index) return { treeRoot: null, filteredRoot: null }

    const names = Object.keys(index).sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    )

    const { root } = buildGeositeTree(names)
    const filtered = filterTreeBySearch(root, debouncedTreeSearch)

    return { treeRoot: root, filteredRoot: filtered }
  }, [index, debouncedTreeSearch])

  const handleExpandAll = () => {
    if (!treeRoot) return
    const allPaths = getAllNodePaths(treeRoot)
    allPaths.forEach(path => {
      if (!geositeExpandedNodes.has(path)) {
        toggleNodeExpansion(path)
      }
    })
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>GeoSite · 规则树</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState>加载规则树...</LoadingState>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>GeoSite · 规则树</CardTitle>
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
        <CardTitle>GeoSite · 规则树</CardTitle>
        <CardDescription>
          按名称片段自动构建树状结构，可展开查看子分类，并在右侧载入规则详情。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索 GeoSite 名称，例如 APPLE 或 MEDIA"
              value={localTreeSearch}
              onChange={(e) => setLocalTreeSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            className="flex items-center gap-2"
          >
            <Expand className="w-4 h-4" />
            展开全部
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAllNodes}
            className="flex items-center gap-2"
          >
            <Minimize className="w-4 h-4" />
            折叠全部
          </Button>
        </div>
        
        <div className="border rounded-md bg-background/50 h-96 overflow-y-auto">
          {filteredRoot && filteredRoot.children.size > 0 ? (
            <div className="p-2">
              {Array.from(filteredRoot.children.values()).map((child) => (
                <GeositeTreeNode
                  key={child.path}
                  node={child}
                  level={0}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {geositeTreeSearch ? '没有找到匹配的规则' : '暂无数据'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
