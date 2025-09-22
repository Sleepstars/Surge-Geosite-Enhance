import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { DatasetToggle } from './DatasetToggle'
import { Badge } from './ui/Badge'

export const IntroSection: React.FC = () => {
  const features = [
    'GeoSite：树状展开，逐级查看规则组',
    'GeoIP：支持关键字过滤与 IPv4 / IPv6 拆分',
    '域名搜索：自动识别域名、关键字与 IP/CIDR',
  ]

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>规则总览</CardTitle>
        <CardDescription>
          GeoSite 提供丰富的域名分类，GeoIP 提供精细的 IP 段划分。
          通过树状结构与反向检索，可快速定位策略归属。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {features.map((feature, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {feature}
            </Badge>
          ))}
        </div>
        
        <DatasetToggle />
      </CardContent>
    </Card>
  )
}
