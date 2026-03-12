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
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"

import {
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
  previousRating?: string
  search?: string
  sortBy?: string
  sectorsSelected?: string[]
  favoritesOnly?: boolean
  breakoutScores?: string[]
}

interface DataTableProps {
  columns: ColumnDef<Stock, unknown>[]
  filters?: Filters
  onFilteredCountChange?: (count: number) => void
}

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
  const limit = currentFilters?.limit || '100';
  params.append('limit', limit); // Fetch initial batch - optimized for LATERAL join performance
  
  // Include market filter - always send alongside search (not mutually exclusive)
  if (currentFilters?.market && currentFilters.market.toLowerCase() !== 'all' && currentFilters.market !== '') {
    params.append('market', currentFilters.market);
  }

  // Include search term in API request for server-side filtering
  if (currentFilters?.search && currentFilters.search.trim() !== '') {
    params.append('search', currentFilters.search);
  }

  // Include rating filter (Relax logic during search handled by backend or user intent)
  if (currentFilters?.rating) {
    params.append('rating', currentFilters.rating);
  }

  // Include technicalRating filter for server-side filtering
  if (currentFilters?.technicalRating) {
    params.append('technical_rating', currentFilters.technicalRating);
  }

  // Include sector filter
  if (currentFilters?.sectorsSelected && currentFilters.sectorsSelected.length > 0) {
    params.append('sectors', currentFilters.sectorsSelected.join(','));
  }

  // Include previous_rating filter
  if (currentFilters?.previousRating && currentFilters.previousRating !== '') {
    params.append('previous_rating', currentFilters.previousRating);
  }

  // Include breakout_scores filter for server-side filtering
  if (currentFilters?.breakoutScores && currentFilters.breakoutScores.length > 0) {
    params.append('breakout_scores', currentFilters.breakoutScores.join(','));
  }

  // Include sort parameters for server-side sorting
  if (currentFilters?.sortBy) {
    params.append('sort_by', currentFilters.sortBy);
  }
  if (currentFilters?.sortOrder) {
    params.append('sort_order', currentFilters.sortOrder);
  }
  // Pass pinned symbols so the DB returns them first (Option 1 - server-side pinning)
  if (currentFilters?.pinnedSymbols && currentFilters.pinnedSymbols.length > 0) {
    params.append('pinned_symbols', currentFilters.pinnedSymbols.join(','));
  }
  
  const response = await fetch(`${API_URL}/api/stocks?${params.toString()}`)
  const result: StockApiResponse = await response.json()
  
  const stocks = result.data.map((s: any) => {
    const currentPrice = Number(s.current_price)
    const previousPrice = s.previous_price ? Number(s.previous_price) : undefined
    
    // Use server-provided values if available, fallback to price difference calculation
    // NOTE: s.change can be null from production DB — use != null to catch both null and undefined
    const absoluteChange = (s.change != null) ? Number(s.change) : (previousPrice ? currentPrice - previousPrice : 0)
    const percentChange = (s.changePercent != null) ? Number(s.changePercent) : (previousPrice && previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice * 100) : 0)
    
    const exchange = s.symbol?.split(":")[0] || ""

    return {
      market: s.market,
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      industry: s.industry,
      current_price: currentPrice,
      previous_price: previousPrice,
      change: absoluteChange, // Absolute price change
      changePercent: percentChange, // Percentage change
      exchange: exchange, // Pre-calculated exchange
      Technical_Rating: s.Technical_Rating,
      Previous_Rating: s.Previous_Rating,
      previous_rating_date: s.previous_rating_date,
      rating_change_date: s.rating_change_date,
      fetched_date: s.fetched_date,
      accuracy_percent: s.accuracy_percent,
      total_signals: s.total_signals,
      breakout_score: s.breakout_score,
    }
  })

  return {
    stocks: stocks,
    // Note: total might be slightly higher than visible stocks due to client-side filtering of "Neutral"
    // until the backend SQL migration is applied.
    total: result.total || 0  
  }
}

import { useFavorites } from "@/hooks/useFavorites"

export function DataTable({ columns, filters, onFilteredCountChange }: DataTableProps) {
  const { favorites, isFavorite } = useFavorites();

  const [sorting, setSorting] = useState<SortingState>([{ id: "rating_change_date", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [fetchLimit, setFetchLimit] = useState(300) // Start with 300 as requested

  // Fetch stocks with React Query
  // All filters (market, search, rating) and sorting are sent to API for server-side processing
  // Database filters: price >= 0.1, excludes OTC, sorts, then limits
  // Only technicalRating (Positive/Negative) grouping is handled client-side
  
  // Convert sorting state to API parameters
  const sortBy = sorting.length > 0 ? sorting[0].id : 'rating_change_date'
  const sortOrder = sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : 'desc'
  
  const { data, isLoading: loading, isFetching } = useQuery({
    queryKey: ['stocks', { 
      market: filters?.market, 
      search: filters?.search, 
      limit: fetchLimit, 
      rating: filters?.currentRating,
      technicalRating: filters?.technicalRating,
      sectorsSelected: filters?.sectorsSelected,
      previousRating: filters?.previousRating,
      breakoutScores: filters?.breakoutScores,
      sortBy: sortBy,
      sortOrder: sortOrder,
      pinnedSymbols: favorites, // favorites passed here → server returns them first
    }],
    queryFn: fetchStocks,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Extract stocks array and total count from response
  const allData = data?.stocks || []
  const totalInDatabase = data?.total || 0

  // Client-side: favorites-only filter (breakout scores now filtered on server)
  // No need to sort favorites here — the server already returns them first.
  const filteredData = useMemo(() => {
    let result = allData;
    if (filters?.favoritesOnly) {
      result = result.filter(stock => isFavorite(stock.symbol));
    }
    return result;
  }, [allData, filters?.favoritesOnly, isFavorite, favorites])


  // React to sortBy filter changes
  useEffect(() => {
    if (filters?.sortBy === "top_gainers") {
      setSorting([{ id: "changePercent", desc: true }])
    } else if (filters?.sortBy === "top_accuracy") {
      setSorting([{ id: "accuracy_percent", desc: true }])
    }
  }, [filters?.sortBy])

  const previousBreakoutLength = useRef<number>(0);

  // Auto-sort by breakout score when starting to filter by breakout
  useEffect(() => {
    const currentLength = filters?.breakoutScores?.length || 0;
    if (currentLength > 0 && previousBreakoutLength.current === 0) {
      setSorting([{ id: "breakout_score", desc: true }]);
    }
    previousBreakoutLength.current = currentLength;
  }, [filters?.breakoutScores]);

  // Notify parent of filtered count changes
  useEffect(() => {
    // Only use filteredData.length for favorites-only view (client-side filter)
    // For all other filters (sectors, breakout, search, etc.), use the total from DB.
    const count = filters?.favoritesOnly ? filteredData.length : totalInDatabase;
    onFilteredCountChange?.(count)
  }, [totalInDatabase, filteredData.length, filters?.favoritesOnly, onFilteredCountChange])

  // Handle scroll to load more from backend
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isFetching) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 400
    
    if (nearBottom) {
        if (allData.length === fetchLimit && fetchLimit < totalInDatabase) {
             const nextLimit = fetchLimit === 300 ? 1000 : fetchLimit === 1000 ? 5000 : 25000;
             if (nextLimit !== fetchLimit) {
                 setFetchLimit(nextLimit);
             }
        }
    }
  }, [isFetching, allData.length, fetchLimit, totalInDatabase])

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, 
    sortDescFirst: true, 
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 20,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

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
          <div className="w-full">
            <table className="w-full caption-bottom text-sm" style={{ tableLayout: 'fixed' }}>
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

                    // Sticky Symbol Column - HEADER
                    // Removed sticky lock as requested.
                    const stickyClass = ""
                    
                    // Reduce padding for numeric columns and exchange to minimize gaps
                    let paddingClass = ''
                    if (header.column.id === 'current_price') {
                      paddingClass = '!px-0.5 sm:!px-1'
                    } else if (header.column.id === 'change') {
                      paddingClass = '!pl-0.5 !pr-2 sm:!pl-1 sm:!pr-3' // Add more right padding
                    } else if (header.column.id === 'changePercent') {
                      paddingClass = '!px-0.5 sm:!px-1'
                    } else if (isSymbol) {
                      paddingClass = '!px-1 sm:!px-2'
                    } else if (isExchange) {
                      paddingClass = '!pl-2 !pr-1' // Left aligned padding
                    }

                    // Responsive width for Symbol
                    const widthStyle = isSymbol 
                      ? { } // Allow class to control width
                      : { width: header.getSize() }
                    
                    // Width 120px
                    const widthClass = isSymbol ? "w-[120px] min-w-[120px] max-w-[120px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]" : ""
                    
                    return (
                      <TableHead
                        key={header.id}
                        className={`text-[#F8FAFC] text-sm cursor-pointer hover:bg-[#1E2530] font-semibold ${alignClass} ${stickyClass} ${paddingClass} ${widthClass} ${!isSymbol && !stickyClass ? 'bg-[#0F151F]' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                        style={widthStyle}
                      >
                        <div className={`flex items-center gap-1 ${alignClass.split(' ')[1]}`}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {!['arrow', 'actions', 'Previous_Rating', 'Technical_Rating'].includes(header.column.id) && header.column.columnDef.header && (
                            <SortArrows 
                              sortDirection={header.column.getIsSorted()}
                              variant={(header.id === 'symbol' || header.id === 'exchange' || header.id === 'sector') ? 'text' : 'standard'}
                              className="shrink-0"
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
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {loading ? (
                // Initial Loading Skeletons
                Array.from({ length: 15 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="bg-[#7588A31A] border-[#1E2530] h-10">
                    {columns.map((_, cIdx) => (
                      <TableCell key={cIdx} className="!py-2 !px-1 sm:!px-2">
                         <div className="h-5 w-full bg-[#18202F]/60 animate-pulse rounded-md"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length > 0 ? (
                virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <TableRow
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="bg-[#7588A31A] hover:bg-[#292D33]/80 border-[#1E2530] cursor-pointer h-10 group"
                      onClick={() => {
                        const stock = row.original as { symbol: string }
                        navigate(`/symbols/${encodeURIComponent(stock.symbol.replace(':', '-'))}`)
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                           const isSymbol = cell.column.id === 'symbol'
                           const isExchange = cell.column.id === 'exchange'
                           
                           const stickyClass = ""
                           
                           let paddingClass = ''
                           if (cell.column.id === 'current_price') {
                             paddingClass = '!py-2 !px-0.5 sm:!px-1'
                           } else if (cell.column.id === 'change') {
                             paddingClass = '!py-2 !pl-0.5 !pr-2 sm:!pl-1 sm:!pr-3'
                           } else if (cell.column.id === 'changePercent') {
                             paddingClass = '!py-2 !px-0.5 sm:!px-1'
                           } else if (isSymbol) {
                             paddingClass = '!py-2 !px-1 sm:!px-2'
                           } else if (isExchange) {
                             paddingClass = '!py-2 !pl-2 !pr-1'
                           }

                           const widthStyle = isSymbol 
                             ? { } 
                             : { width: cell.column.getSize() }
                           const widthClass = isSymbol ? "w-[120px] min-w-[120px] max-w-[120px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]" : ""

                           return (
                            <TableCell 
                              key={cell.id} 
                              className={`${paddingClass} ${stickyClass} ${widthClass}`}
                              style={widthStyle}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                           )
                      })}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[#7588A3]">
                    No results.
                  </TableCell>
                </TableRow>
              )}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </TableBody>
            </table>
          </div>
          
        </div>
      </div>
      
      {/* Infinite Scroll & Loading Indicator */}
      <div className="flex flex-col items-center py-2 bg-[#0F151F]/50 min-h-[5px]">
        {/* Invisible spacer for scroll padding */}
        <div className="h-1 w-full" />
      </div>
    </div>
  )
}
