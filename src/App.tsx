import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import StockList from "./components/StockList";
import SummaryInfo from './components/SummaryInfo'; 
import StockListFilter from "./components/StockListFilter";
import AnalyticsPage from "./components/AnalyticsPage";
import type { Stock } from "./types/stock";
import "react-day-picker/dist/style.css";


function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [_filters, setFilters] = useState({
    market: "",
    previousRating: "",
    currentRating: "",
    technicalRating: "",
    search: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/src/api/data/ALL_MARKETS.json`);
        const data = await response.json();

        // Get today's and yesterday's dates
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Group data by symbol to find today's and yesterday's entries
        const symbolMap = new Map<string, any[]>();
        data.forEach((entry: any) => {
          const key = entry.symbol;
          if (!symbolMap.has(key)) {
            symbolMap.set(key, []);
          }
          symbolMap.get(key)!.push(entry);
        });

        // Transform data to Stock type - limit to 50 rows
        const stocks: Stock[] = Array.from(symbolMap.values())
          .slice(0, 50)
          .map((entries: any[]) => {
            // Find today's entry (most recent)
            const todayEntry = entries.find(e => e.fetched_at?.includes(todayStr)) || entries[entries.length - 1];
            
            // Find yesterday's entry
            const yesterdayEntry = entries.find(e => e.fetched_at?.includes(yesterdayStr));
            
            return {
              market: todayEntry.market,
              symbol: todayEntry.symbol,
              name: todayEntry.name,
              current_price: Number(todayEntry.current_price),
              yesterday_price: yesterdayEntry ? Number(yesterdayEntry.current_price) : Number(todayEntry.current_price),
              Technical_Rating: todayEntry.Technical_Rating,
              Yesterday_Rating: "N/A",
            };
          });

        setAllStocks(stocks);
        setStocks(stocks);
      } catch (error) {
        console.error("Error loading stock data:", error);
      }
    };

    loadData();
  }, []);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);

    let filtered = allStocks;

    // Filter by market
    if (newFilters.market) {
      filtered = filtered.filter((stock) =>
        stock.market === newFilters.market
      );
    }

    // Filter by previous rating
    if (newFilters.previousRating) {
      filtered = filtered.filter((stock) =>
        stock.Yesterday_Rating === newFilters.previousRating
      );
    }

    // Filter by current rating
    if (newFilters.currentRating) {
      filtered = filtered.filter((stock) =>
        stock.Technical_Rating === newFilters.currentRating
      );
    }

    // Filter by technical rating (Positive: Buy, Strong Buy | Negative: Sell, Strong Sell)
    if (newFilters.technicalRating) {
      if (newFilters.technicalRating === "Positive") {
        filtered = filtered.filter((stock) =>
          stock.Technical_Rating === "Buy" || stock.Technical_Rating === "Strong Buy"
        );
      } else if (newFilters.technicalRating === "Negative") {
        filtered = filtered.filter((stock) =>
          stock.Technical_Rating === "Sell" || stock.Technical_Rating === "Strong Sell"
        );
      }
    }

    // Filter by search text
    if (newFilters.search.trim() !== "") {
      const searchLower = newFilters.search.toLowerCase();
      filtered = filtered.filter((stock) =>
        stock.symbol.toLowerCase().includes(searchLower) ||
        stock.name.toLowerCase().includes(searchLower)
      );
    }

    setStocks(filtered);
  };

  return (
    <>
      <SummaryInfo stocks={stocks} />
      <StockListFilter onChange={handleFilterChange} />
      <div>
        <StockList stocks={stocks} />
      </div>
    </>
  );
}

function App() {
  return (
    <div className="App bg-[#000000] min-h-screen text-[#F8FAFC]">
      <MenuHeader />
      <Routes>
        <Route path="/" element={<ScreenerPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </div>
  );
}

export default App

