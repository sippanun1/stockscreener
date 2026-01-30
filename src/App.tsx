import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import { DataTable } from "./components/stock-table/data-table";
import { stockColumns } from "./components/stock-table/columns";
import SummaryInfo from "./components/SummaryInfo";
import StockListFilter from "./components/StockListFilter";
import StockDetail from "./components/StockDetail";
import NotFound from "./components/NotFound";
import "react-day-picker/dist/style.css";


function ScreenerPage() {
  const [filters, setFilters] = useState({
    market: "",
    previousRating: "",
    currentRating: "",
    technicalRating: "",
    date: "",
    search: "",
    sortBy: undefined as string | undefined,
  });
  const [filteredCount, setFilteredCount] = useState(0);

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, []);

  const handleFilteredCountChange = useCallback((count: number) => {
    setFilteredCount(count);
  }, []);

  const handleSummaryFilterChange = (filterType: string) => {
    if (filterType === "Positive" || filterType === "Negative") {
      setFilters(prev => ({ ...prev, technicalRating: filterType, currentRating: "", sortBy: undefined }));
    } else if (filterType === "Top Gainers") {
      setFilters(prev => ({ 
        ...prev, 
        technicalRating: "", 
        currentRating: "", 
        sortBy: "top_gainers" 
      }));
    } else {
      setFilters(prev => ({ ...prev, currentRating: filterType, technicalRating: "", sortBy: undefined }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SummaryInfo stocks={[]} onFilterChange={handleSummaryFilterChange} />
      <StockListFilter onChange={handleFilterChange} filteredCount={filteredCount} currentFilters={filters} />
      <div className="flex-1 overflow-hidden min-h-0">
        <DataTable columns={stockColumns} filters={filters} onFilteredCountChange={handleFilteredCountChange} />
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App bg-[#000000] h-[100dvh] flex flex-col overflow-hidden">
      <MenuHeader />
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/" element={<ScreenerPage />} />
          <Route path="/symbols/:symbol" element={<StockDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

    </div>
  );
}

export default App
