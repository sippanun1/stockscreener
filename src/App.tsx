import { useEffect, useState } from 'react'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import StockList from "./components/StockList";
import SummaryInfo from './components/SummaryInfo'; 
import StockListFilter from "./components/StockListFilter";
import type { Stock } from "./types/stock";
import "react-day-picker/dist/style.css";


function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [filters, setFilters] = useState({
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

        // Transform data to Stock type - limit to 50 rows
        const stocks: Stock[] = data.slice(-50, -1).map((s: any) => ({
          market: s.market,
          symbol: s.symbol,
          name: s.name,
          current_price: Number(s.current_price),
          Technical_Rating: s.Technical_Rating,
          Yesterday_Rating: "N/A",
        }));

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
    <div className="App bg-[#000000] min-h-screen text-[#F8FAFC]">
      <MenuHeader />
      <SummaryInfo stocks={stocks} />
      <StockListFilter onChange={handleFilterChange} />
      <div>
        <StockList stocks={stocks} />
      </div>
    </div>
  );
}

export default App
