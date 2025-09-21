import { create } from 'zustand'
import { Dataset } from '@/types'

interface AppState {
  activeDataset: Dataset
  setActiveDataset: (dataset: Dataset) => void
  
  // Geosite state
  geositeTreeSearch: string
  setGeositeTreeSearch: (search: string) => void
  
  geositeExpandedNodes: Set<string>
  toggleNodeExpansion: (path: string) => void
  expandAllNodes: () => void
  collapseAllNodes: () => void
  
  geositeSelectedName: string
  setGeositeSelectedName: (name: string) => void
  
  geositeAttributeFilter: string
  setGeositeAttributeFilter: (filter: string) => void
  
  geositeRuleFilter: string
  setGeositeRuleFilter: (filter: string) => void
  
  // Geoip state
  geoipSearch: string
  setGeoipSearch: (search: string) => void
  
  geoipVersionFilter: 'both' | 'ipv4' | 'ipv6'
  setGeoipVersionFilter: (version: 'both' | 'ipv4' | 'ipv6') => void
  
  geoipSelectedName: string
  setGeoipSelectedName: (name: string) => void
  
  geoipCidrFilter: string
  setGeoipCidrFilter: (filter: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeDataset: 'geosite',
  setActiveDataset: (dataset) => set({ activeDataset: dataset }),
  
  // Geosite state
  geositeTreeSearch: '',
  setGeositeTreeSearch: (search) => set({ geositeTreeSearch: search }),
  
  geositeExpandedNodes: new Set(),
  toggleNodeExpansion: (path) => set((state) => {
    const newExpanded = new Set(state.geositeExpandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    return { geositeExpandedNodes: newExpanded }
  }),
  expandAllNodes: () => set((state) => {
    // This would need to be called with all possible paths
    // For now, we'll implement this in the component
    return state
  }),
  collapseAllNodes: () => set({ geositeExpandedNodes: new Set() }),
  
  geositeSelectedName: '',
  setGeositeSelectedName: (name) => set({ geositeSelectedName: name }),
  
  geositeAttributeFilter: '',
  setGeositeAttributeFilter: (filter) => set({ geositeAttributeFilter: filter }),
  
  geositeRuleFilter: '',
  setGeositeRuleFilter: (filter) => set({ geositeRuleFilter: filter }),
  
  // Geoip state
  geoipSearch: '',
  setGeoipSearch: (search) => set({ geoipSearch: search }),
  
  geoipVersionFilter: 'both',
  setGeoipVersionFilter: (version) => set({ geoipVersionFilter: version }),
  
  geoipSelectedName: '',
  setGeoipSelectedName: (name) => set({ geoipSelectedName: name }),
  
  geoipCidrFilter: '',
  setGeoipCidrFilter: (filter) => set({ geoipCidrFilter: filter }),
}))
