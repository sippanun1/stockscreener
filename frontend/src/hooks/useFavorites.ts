import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'stock_favorites';
// Custom event name to sync state between multiple hook instances on the same page
const SYNC_EVENT = 'favorites_updated';

function readFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFromStorage);

  // Listen for changes from other hook instances (e.g. star button in columns.tsx
  // updating state that data-table.tsx also needs to reflect immediately)
  useEffect(() => {
    const handleSync = () => {
      setFavorites(readFromStorage());
    };

    window.addEventListener(SYNC_EVENT, handleSync);
    // Also handle cross-tab updates via the native storage event
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavs));
        // Notify all other useFavorites instances on the same page
        window.dispatchEvent(new Event(SYNC_EVENT));
      } catch (e) {
        console.error('Failed to save favorites to localStorage', e);
      }
      return newFavs;
    });
  }, []);

  const isFavorite = useCallback((symbol: string) => {
    return favorites.includes(symbol);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
