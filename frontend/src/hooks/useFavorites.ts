import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'stock_favorites';

// Module-level state: Single Source of Truth for this tab
let inMemoryFavorites: string[] = [];

// Initialize memory from storage on load
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  inMemoryFavorites = saved ? JSON.parse(saved) : [];
} catch {
  inMemoryFavorites = [];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export function useFavorites() {
  // Use state to trigger re-renders, but always sync with inMemoryFavorites
  const [favorites, setFavorites] = useState<string[]>(inMemoryFavorites);

  useEffect(() => {
    const handleChange = () => {
      setFavorites([...inMemoryFavorites]);
    };

    listeners.add(handleChange);

    // Sync from other tabs/windows
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          inMemoryFavorites = e.newValue ? JSON.parse(e.newValue) : [];
          notify();
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      listeners.delete(handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    const isFav = inMemoryFavorites.includes(symbol);
    
    if (isFav) {
      inMemoryFavorites = inMemoryFavorites.filter(s => s !== symbol);
    } else {
      inMemoryFavorites = [...inMemoryFavorites, symbol];
    }

    // Persist and Notify
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryFavorites));
    } catch {
      // Ignore
    }
    
    notify();
  }, []);

  const isFavorite = useCallback((symbol: string) => {
    return favorites.includes(symbol);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
