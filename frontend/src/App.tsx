import { useState, useCallback, Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import StockListFilter from "./components/StockListFilter";
import NotFound from "./components/NotFound";
import "react-day-picker/dist/style.css";

// Lazy load heavy components to reduce initial bundle size
const DataTable = lazy(() => import("./components/stock-table/data-table").then(module => ({ default: module.DataTable })));
const SummaryInfo = lazy(() => import("./components/SummaryInfo"));
const StockDetail = lazy(() => import("./components/StockDetail"));
import { stockColumns } from "./components/stock-table/columns";


function ScreenerPage() {
  const [filters, setFilters] = useState({
    market: "",
    previousRating: "",
    currentRating: "",
    technicalRating: "",
    sector: "",
    date: "",
    search: "",
    sortBy: undefined as string | undefined,
    favoritesOnly: false,
    breakoutScores: [],
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
      setFilters(prev => ({ ...prev, technicalRating: filterType, currentRating: "", sortBy: undefined, search: "" }));
    } else if (filterType === "Top Gainers") {
      setFilters(prev => ({ 
        ...prev, 
        technicalRating: "", 
        currentRating: "", 
        sortBy: "top_gainers",
        search: "" 
      }));
    } else if (filterType === "Top Accuracy") {
      setFilters(prev => ({ 
        ...prev, 
        technicalRating: "", 
        currentRating: "", 
        sortBy: "top_accuracy",
        search: "" 
      }));
    } else {
      setFilters(prev => ({ ...prev, currentRating: filterType, technicalRating: "", sortBy: undefined, search: "" }));
    }
  };



  return (
    <div className="flex flex-col lg:h-full">
      <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#12b327]"></div></div>}>
        <SummaryInfo stocks={[]} onFilterChange={handleSummaryFilterChange} />
        <StockListFilter onChange={handleFilterChange} filteredCount={filteredCount} currentFilters={filters} />
        {/* Mobile: Fixed height table (nested scroll). Desktop: Flex-1 filling remaining space. */}
        <div className="h-[75vh] lg:h-auto lg:flex-1 overflow-hidden min-h-0">
          <DataTable columns={stockColumns} filters={filters} onFilteredCountChange={handleFilteredCountChange} />
        </div>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <div className="App bg-[#000000] h-[100dvh] flex flex-col overflow-hidden">
      <MenuHeader />
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#12b327]"></div></div>}>
          <Routes>
            <Route path="/" element={<ScreenerPage />} />
            <Route path="/symbols/:symbol" element={<StockDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>

    </div>
  );
}

export default App
