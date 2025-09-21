import React from 'react'
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react'
import { clsx } from 'clsx'
import { TreeNode } from '@/types'
import { useAppStore } from '@/stores/useAppStore'

interface GeositeTreeNodeProps {
  node: TreeNode
  level: number
}

export const GeositeTreeNode: React.FC<GeositeTreeNodeProps> = ({ node, level }) => {
  const { 
    geositeExpandedNodes, 
    toggleNodeExpansion, 
    geositeSelectedName,
    setGeositeSelectedName 
  } = useAppStore()
  
  const isExpanded = geositeExpandedNodes.has(node.path)
  const isSelected = geositeSelectedName === node.fullName
  const hasChildren = node.children.size > 0
  const isLeaf = !!node.fullName

  const handleToggle = () => {
    if (hasChildren) {
      toggleNodeExpansion(node.path)
    }
  }

  const handleSelect = () => {
    if (isLeaf && node.fullName) {
      setGeositeSelectedName(node.fullName)
    }
  }

  const handleClick = () => {
    if (isLeaf) {
      handleSelect()
    } else {
      handleToggle()
    }
  }

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-primary/10 text-primary',
          isLeaf && 'hover:bg-primary/5'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            className="flex items-center justify-center w-4 h-4 hover:bg-accent rounded-sm"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        
        {isLeaf ? (
          <File className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground" />
        )}
        
        <span className={clsx(
          'text-sm truncate',
          isLeaf ? 'font-normal' : 'font-medium'
        )}>
          {node.label}
        </span>
        
        {isLeaf && (
          <span className="text-xs text-muted-foreground ml-auto">
            {node.fullName}
          </span>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {Array.from(node.children.values()).map((child) => (
            <GeositeTreeNode
              key={child.path}
              node={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
