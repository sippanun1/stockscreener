import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import MenuHeader from "./components/MenuHeader";
import NotFound from "./components/NotFound";

const StockDetail = lazy(() => import("./components/StockDetail"));
const ScreenerPage = lazy(() => import("./pages/ScreenerPage"));
function App() {
  return (
    <div className="App bg-[#000000] h-[100dvh] flex flex-col overflow-hidden">
      <MenuHeader />
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <Suspense fallback={<div className="h-full w-full"></div>}>
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
