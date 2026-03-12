import { useState, useCallback, Suspense, lazy } from 'react'

import StockListFilter from "@/components/StockListFilter";
import "react-day-picker/dist/style.css";

// Lazy load heavy components to reduce initial bundle size
const DataTable = lazy(() => import("@/components/stock-table/data-table").then(module => ({ default: module.DataTable })));
const SummaryInfo = lazy(() => import("@/components/SummaryInfo"));

import { stockColumns } from "@/components/stock-table/columns";

export default function ScreenerPage() {
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
      <Suspense fallback={<div className="h-64"></div>}>
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
