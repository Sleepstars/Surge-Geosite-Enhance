import React from 'react'
import { clsx } from 'clsx'
import { Badge } from '../ui/Badge'
import { RuleItem } from '@/types'

interface GeositeRuleItemProps {
  rule: RuleItem
  index: number
}

const getRuleTypeColor = (type: string) => {
  switch (type) {
    case 'domain':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'full':
      return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'keyword':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    case 'regexp':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

const getRuleTypeLabel = (type: string) => {
  switch (type) {
    case 'domain':
      return 'DOMAIN-SUFFIX'
    case 'full':
      return 'DOMAIN'
    case 'keyword':
      return 'DOMAIN-KEYWORD'
    case 'regexp':
      return 'REGEXP'
    default:
      return type.toUpperCase()
  }
}

export const GeositeRuleItem: React.FC<GeositeRuleItemProps> = ({ rule, index }) => {
  return (
    <div 
      className={clsx(
        'p-3 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors',
        index % 2 === 0 ? 'bg-background/50' : 'bg-background/30'
      )}
    >
      <div className="flex items-start gap-3">
        <Badge 
          variant="outline" 
          className={clsx('text-xs font-mono', getRuleTypeColor(rule.type))}
        >
          {getRuleTypeLabel(rule.type)}
        </Badge>
        
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm break-all">
            {rule.value}
          </div>
          
          {rule.attrs && rule.attrs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground">标签：</span>
              {rule.attrs.map((attr, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {attr}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
