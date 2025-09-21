import React from 'react'
import { clsx } from 'clsx'
import { useAppStore } from '@/stores/useAppStore'
import { Dataset } from '@/types'

export const DatasetToggle: React.FC = () => {
  const { activeDataset, setActiveDataset } = useAppStore()

  const datasets: { key: Dataset; label: string }[] = [
    { key: 'geosite', label: 'GeoSite' },
    { key: 'geoip', label: 'GeoIP' },
  ]

  return (
    <div className="flex rounded-lg bg-muted p-1">
      {datasets.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveDataset(key)}
          className={clsx(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all',
            activeDataset === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
