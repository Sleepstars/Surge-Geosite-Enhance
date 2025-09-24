import { useDeferredValue, useMemo } from 'react'

export function useDeferredSearch<T>(
  items: T[],
  searchTerm: string,
  searchFn: (item: T, term: string) => boolean
) {
  const deferredSearchTerm = useDeferredValue(searchTerm)

  const filteredItems = useMemo(() => {
    if (!deferredSearchTerm) return items
    return items.filter(item => searchFn(item, deferredSearchTerm))
  }, [items, deferredSearchTerm, searchFn])

  const isSearching = searchTerm !== deferredSearchTerm

  return { filteredItems, isSearching }
}