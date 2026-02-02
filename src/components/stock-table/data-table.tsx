"use client"

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Stock } from "@/types/stock"
import { SortArrows } from "@/components/SortArrows"

interface Filters {
  market?: string
  currentRating?: string
  technicalRating?: string
  search?: string
  sortBy?: string
}

interface DataTableProps {
  columns: ColumnDef<Stock, unknown>[]
  filters?: Filters
  onFilteredCountChange?: (count: number) => void
}

const BATCH_SIZE = 100

// API base URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Response type from API
interface StockApiResponse {
  data: any[];
  count: number;
  total: number;
}

// Fetch function for React Query - returns stocks and total count
const fetchStocks = async ({ queryKey }: any): Promise<{ stocks: Stock[], total: number }> => {
  const [_, currentFilters] = queryKey;
  
  const params = new URLSearchParams();
  const limit = currentFilters?.limit || '2000';
  params.append('limit', limit); // Fetch initial small amount for speed
  
  if (currentFilters?.market && currentFilters.market !== 'all') {
    params.append('market', currentFilters.market);
  }

  // Include search term in API request for server-side filtering
  if (currentFilters?.search && currentFilters.search.trim() !== '') {
    params.append('search', currentFilters.search);
  }

  // Include rating filter for accurate count
  if (currentFilters?.rating) {
    params.append('rating', currentFilters.rating);
  }
  
  const response = await fetch(`${API_URL}/api/stocks?${params.toString()}`)
  const result: StockApiResponse = await response.json()
  
  const stocks = result.data.map((s: any) => {
    const currentPrice = Number(s.current_price)
    const previousPrice = s.previous_price ? Number(s.previous_price) : undefined
    const change = previousPrice && previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice * 100) : 0
    const exchange = s.symbol?.split(":")[0] || ""

    return {
      market: s.market,
      symbol: s.symbol,
      name: s.name,
      current_price: currentPrice,
      previous_price: previousPrice,
      change: change, // Pre-calculated % change
      exchange: exchange, // Pre-calculated exchange
      Technical_Rating: s.Technical_Rating,
      Previous_Rating: s.Previous_Rating,
      previous_rating_date: s.previous_rating_date,
      rating_change_date: s.rating_change_date,
      fetched_date: s.fetched_date,
    }
  })

  return {
    stocks: stocks,
    total: result.total || 0  // Total count from database
  }
}

export function DataTable({ columns, filters, onFilteredCountChange }: DataTableProps) {
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "fetched_date", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [fetchLimit, setFetchLimit] = useState(2000)

  // Fetch stocks with React Query
  // Fixed: Include search and limit in queryKey to re-fetch when searching or loading more
  // Note: technicalRating (Positive/Negative) is handled client-side, only currentRating goes to API
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['stocks', { market: filters?.market, search: filters?.search, limit: fetchLimit, rating: filters?.currentRating }],
    queryFn: fetchStocks,
    staleTime: 5 * 60 * 1000, 
  })

  // Extract stocks array and total count from response
  const allData = data?.stocks || []
  const totalInDatabase = data?.total || 0

  // Apply LOCAL filters (Rating, Search, Price)
  const filteredData = useMemo(() => {
    if (allData.length === 0) return []

    let filtered = [...allData]

    // Filter out stocks with price below 0.1
    filtered = filtered.filter((stock) => stock.current_price >= 0.1)

    // Filter out OTC exchanges (Using pre-calculated exchange field)
    filtered = filtered.filter((stock) => stock.exchange !== "OTC")

    // External Filters (Market is already filtered by API, but double check doesn't hurt)
    if (filters?.market) {
      filtered = filtered.filter((stock) => stock.market === filters.market)
    }
    if (filters?.currentRating) {
      filtered = filtered.filter((stock) => stock.Technical_Rating === filters.currentRating)
    }
    if (filters?.technicalRating) {
      if (filters.technicalRating === "Positive") {
        filtered = filtered.filter((stock) =>
          stock.Technical_Rating === "Buy" || stock.Technical_Rating === "Strong Buy"
        )
      } else if (filters.technicalRating === "Negative") {
        filtered = filtered.filter((stock) =>
          stock.Technical_Rating === "Sell" || stock.Technical_Rating === "Strong Sell"
        )
      }
    }
    // External Search
    if (filters?.search && filters.search.trim() !== "") {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((stock) =>
        stock.symbol.toLowerCase().includes(searchLower) ||
        stock.name.toLowerCase().includes(searchLower)
      )
    }

    // Apply Sorting
    if (sorting.length > 0) {
      const { id, desc } = sorting[0]
      filtered.sort((a, b) => {
        let aValue: any = a[id as keyof Stock]
        let bValue: any = b[id as keyof Stock]

        // Handle calculated columns (Now using pre-calculated fields or simple fallbacks)
        if (id === "change" || id === "changePercent") {
           // We've pre-calculated 'change' to be the % value
           aValue = (a as any).change || 0
           bValue = (b as any).change || 0
        } else if (id === "fetched_date") {
          // Sort by signal date (rating_change_date) if available
          aValue = a.rating_change_date || a.fetched_date
          bValue = b.rating_change_date || b.fetched_date
        }

        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        if (aValue > bValue) return desc ? -1 : 1
        return 1 // simplified
      })
    }

    return filtered
  }, [filters, allData, sorting])

  // React to sortBy filter changes
  useEffect(() => {
    if (filters?.sortBy === "top_gainers") {
      setSorting([{ id: "changePercent", desc: true }])
    }
  }, [filters?.sortBy])

  // Notify parent of filtered count changes
  useEffect(() => {
    // Use totalInDatabase when we can trust it (only server-side filters active)
    // Use filteredData.length when client-side filters are applied (technicalRating)
    const hasClientSideFilter = !!filters?.technicalRating
    const countToShow = hasClientSideFilter ? filteredData.length : totalInDatabase
    
    onFilteredCountChange?.(countToShow)
  }, [filteredData.length, totalInDatabase, filters?.technicalRating, onFilteredCountChange])

  // Slice data for display
  const currentData = useMemo(() => {
    return filteredData.slice(0, displayCount)
  }, [filteredData, displayCount])

  // Handle scroll to load more
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loadingMore) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 200
    
    if (nearBottom && displayCount < filteredData.length) {
      setLoadingMore(true)
      setTimeout(() => {
        setDisplayCount(prev => Math.min(prev + BATCH_SIZE, filteredData.length))
        setLoadingMore(false)
      }, 100)
    }
  }, [displayCount, filteredData.length, loadingMore])

  const table = useReactTable({
    data: currentData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    // getSortedRowModel: getSortedRowModel(), // Disable client-side sorting of the slice
    manualSorting: true, // Enable manual sorting
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-[53px] mt-4 flex items-center justify-center h-[400px]">
        <div className="text-[#7588A3]">Loading stocks...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-[53px] mt-3 sm:mt-4 h-full flex flex-col">


      {/* Table with scroll */}
      <div className="rounded-md border border-[#1E2530] overflow-hidden flex-1">
        <div 
          ref={scrollRef}
          className="h-full overflow-auto"
          onScroll={handleScroll}
        >
          {/* Horizontal scroll wrapper for mobile */}
          <div className="min-w-full w-max lg:w-full">
            <table className="w-full caption-bottom text-sm" style={{ tableLayout: 'auto' }}>
            <TableHeader className="bg-[#0F151F] sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-[#1E2530] hover:bg-[#1E2530]">
                  {headerGroup.headers.map((header) => {
                    // Determine alignment based on column
                    const isExchange = header.column.id === 'exchange'
                    const isNumeric = ['current_price', 'change', 'changePercent'].includes(header.column.id)
                    const isSymbol = header.column.id === 'symbol'
                    
                    const alignClass = isExchange 
                      ? 'text-left justify-start' 
                      : isNumeric 
                        ? 'text-right justify-end' 
                        : 'text-center justify-center'

                    // No sticky for symbol column - prevent overlapping
                    const stickyClass = ""
                    
                    // Reduce padding for numeric columns to minimize gaps - use !important to override default
                    // Also reduce padding for symbol column in mobile
                    const paddingClass = isNumeric ? '!px-1.5' : isSymbol ? '!px-1 sm:!px-2' : ''
                    
                    return (
                      <TableHead
                        key={header.id}
                        className={`text-[#F8FAFC] text-sm cursor-pointer hover:bg-[#1E2530] font-semibold ${alignClass} ${stickyClass} ${paddingClass} ${!isSymbol ? 'bg-[#0F151F]' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        <div className={`flex items-center gap-1 ${alignClass.split(' ')[1]}`}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {header.column.getCanSort() && (
                            <SortArrows 
                              sortDirection={header.column.getIsSorted()}
                            />
                          )}
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="bg-[#7588A31A] hover:bg-[#292D33]/80 border-[#1E2530] cursor-pointer h-10 group"
                    onClick={() => {
                      const stock = row.original as { symbol: string }
                      navigate(`/symbols/${encodeURIComponent(stock.symbol.replace(':', '-'))}`)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                         const isSymbol = cell.column.id === 'symbol'
                         const stickyClass = ""
                         
                         // Reduce padding for numeric columns to minimize gaps - use !important to override default
                         const isNumeric = ['current_price', 'change', 'changePercent'].includes(cell.column.id)
                         // Also reduce padding for symbol column in mobile
                         const paddingClass = isNumeric ? '!py-2 !px-1.5' : isSymbol ? '!py-2 !px-1 sm:!px-2' : ''

                         return (
                          <TableCell 
                            key={cell.id} 
                            className={`${paddingClass} ${stickyClass}`}
                            style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                         )
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[#7588A3]">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </table>
          </div>
          
          {/* Loading more indicator */}
          {loadingMore && (
            <div className="text-center py-4 text-[#7588A3]">
              Loading more...
            </div>
          )}
          
          {/* Scroll hint / Load more all */}
          <div className="flex flex-col items-center py-4 border-t border-[#1E2530] bg-[#0F151F]/50">
            {displayCount < filteredData.length && !loadingMore && (
              <div className="text-xs text-[#7588A3] mb-2">
                Scroll down to see more of the current {allData.length} records
              </div>
            )}
            
            {allData.length === fetchLimit && !loading && (
              <button 
                onClick={() => setFetchLimit(50000)}
                className="px-6 py-2 bg-[#1E2530] hover:bg-[#292D33] text-[#F8FAFC] text-sm font-medium rounded-lg transition-colors border border-[#7588A3]/20"
              >
                Load All Stocks (50,000 max)
              </button>
            )}
            
            {allData.length > 2000 && (
              <div className="mt-2 text-[10px] text-[#7588A3] opacity-60">
                Viewing {allData.length} stocks
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
