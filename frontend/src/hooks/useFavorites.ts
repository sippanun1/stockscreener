import { useState, useEffect, useCallback } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock_favorites');
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse favorites from localStorage', e);
    }
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
      
      try {
        localStorage.setItem('stock_favorites', JSON.stringify(newFavs));
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
