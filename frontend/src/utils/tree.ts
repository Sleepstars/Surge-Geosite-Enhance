import { TreeNode } from '@/types'

export const splitSegments = (name: string): string[] => {
  return name
    .split(/[-_:]+/)
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

export const buildGeositeTree = (names: string[]): { root: TreeNode; branchPaths: string[] } => {
  const root: TreeNode = {
    label: '',
    path: '',
    children: new Map(),
  }
  
  const branchPaths: string[] = []

  for (const name of names) {
    const segments = splitSegments(name)
    let current = root
    let currentPath = ''

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!
      const segmentPath = currentPath ? `${currentPath}-${segment}` : segment
      
      if (!current.children.has(segment)) {
        const node: TreeNode = {
          label: segment,
          path: segmentPath,
          children: new Map(),
        }
        
        // If this is the last segment, it's a leaf node
        if (i === segments.length - 1) {
          node.fullName = name
        } else {
          // It's a branch node
          branchPaths.push(segmentPath)
        }
        
        current.children.set(segment, node)
      }
      
      current = current.children.get(segment)!
      currentPath = segmentPath
    }
  }

  return { root, branchPaths }
}

export const filterTreeBySearch = (node: TreeNode, search: string): TreeNode | null => {
  if (!search) return node
  
  const searchLower = search.toLowerCase()
  
  // Check if current node matches
  const nodeMatches = node.label.toLowerCase().includes(searchLower) ||
                     (node.fullName && node.fullName.toLowerCase().includes(searchLower))
  
  // Filter children recursively
  const filteredChildren = new Map<string, TreeNode>()
  for (const [key, child] of node.children) {
    const filteredChild = filterTreeBySearch(child, search)
    if (filteredChild) {
      filteredChildren.set(key, filteredChild)
    }
  }
  
  // Include this node if it matches or has matching children
  if (nodeMatches || filteredChildren.size > 0) {
    return {
      ...node,
      children: filteredChildren,
    }
  }
  
  return null
}

export const getAllNodePaths = (node: TreeNode, paths: string[] = []): string[] => {
  if (node.path) {
    paths.push(node.path)
  }
  
  for (const child of node.children.values()) {
    getAllNodePaths(child, paths)
  }
  
  return paths
}
