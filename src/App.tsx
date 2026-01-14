import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import { DataTable } from "./components/stock-table/data-table";
import { stockColumns } from "./components/stock-table/columns";
import SummaryInfo from './components/SummaryInfo'; 
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
  });

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SummaryInfo stocks={[]} />
      <StockListFilter onChange={handleFilterChange} />
      <div className="flex-1 overflow-hidden">
        <DataTable columns={stockColumns} filters={filters} />
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App bg-[#000000] h-screen flex flex-col overflow-x-hidden overflow-y-auto">
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
