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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState, useRef, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Stock } from "@/types/stock"
import { SortArrows } from "@/components/SortArrows"

interface Filters {
  market?: string
  previousRating?: string
  currentRating?: string
  technicalRating?: string
  date?: string
  search?: string
}

interface DataTableProps {
  columns: ColumnDef<Stock, unknown>[]
  filters?: Filters
}

const BATCH_SIZE = 100

export function DataTable({ columns, filters }: DataTableProps) {
  const [data, setData] = useState<Stock[]>([])
  const [allData, setAllData] = useState<Stock[]>([])
  const [filteredData, setFilteredData] = useState<Stock[]>([])
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load all data once
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Fetch stocks without date filter to show all markets
        const response = await fetch(`http://localhost:8000/api/stocks?limit=25000`)
        const result = await response.json()
        
        const stocks: Stock[] = result.data.map((s: any) => ({
          market: s.market,
          symbol: s.symbol,
          name: s.name,
          current_price: Number(s.current_price),
          previous_price: s.previous_price ? Number(s.previous_price) : undefined,
          Technical_Rating: s.Technical_Rating,
          Previous_Rating: s.Previous_Rating,
          previous_rating_date: s.previous_rating_date,
          fetched_date: s.fetched_date,
        }))
        
        setAllData(stocks)
        setFilteredData(stocks)
        setData(stocks.slice(0, BATCH_SIZE))
      } catch (error) {
        console.error("Error loading stock data:", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Apply external filters and internal search
  useEffect(() => {
    if (allData.length === 0) return

    let filtered = allData

    // External Filters
    if (filters?.market) {
      filtered = filtered.filter((stock) => stock.market === filters.market)
    }
    if (filters?.previousRating) {
      filtered = filtered.filter((stock) => stock.Previous_Rating === filters.previousRating)
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
    // Date Filter - filter by when current rating started (fetched_date)
    if (filters?.date) {
      filtered = filtered.filter((stock) => {
        if (!stock.fetched_date) return false
        // Extract date portion from timestamp (YYYY-MM-DD)
        const stockDate = stock.fetched_date.split('T')[0]
        return stockDate === filters.date
      })
    }
    // External Search
    if (filters?.search && filters.search.trim() !== "") {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((stock) =>
        stock.symbol.toLowerCase().includes(searchLower) ||
        stock.name.toLowerCase().includes(searchLower)
      )
    }

    // Apply Sorting to the full dataset
    if (sorting.length > 0) {
      const { id, desc } = sorting[0]
      filtered.sort((a, b) => {
        let aValue: any = a[id as keyof Stock]
        let bValue: any = b[id as keyof Stock]

        // Handle calculated columns
        if (id === "change") {
          aValue = (a.current_price || 0) - (a.previous_price || 0)
          bValue = (b.current_price || 0) - (b.previous_price || 0)
        } else if (id === "changePercent") {
          const aPrev = a.previous_price || 0
          const bPrev = b.previous_price || 0
          aValue = aPrev === 0 ? 0 : ((a.current_price || 0) - aPrev) / aPrev
          bValue = bPrev === 0 ? 0 : ((b.current_price || 0) - bPrev) / bPrev
        }

        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        if (aValue > bValue) return desc ? -1 : 1
        if (aValue < bValue) return desc ? 1 : -1
        return 0
      })
    }

    setFilteredData(filtered)
    setDisplayCount(BATCH_SIZE)
    setData(filtered.slice(0, BATCH_SIZE))
  }, [filters, allData, sorting])


  // Load more when displayCount changes
  useEffect(() => {
    if (filteredData.length > 0) {
      setData(filteredData.slice(0, displayCount))
    }
  }, [displayCount, filteredData])

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
    data,
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
      <div className="mx-[53px] mt-[17px] flex items-center justify-center h-[400px]">
        <div className="text-[#7588A3]">Loading stocks...</div>
      </div>
    )
  }

  return (
    <div className="mx-[53px] mt-[17px] h-full flex flex-col">


      {/* Table with scroll */}
      <div className="rounded-md border border-[#1E2530] overflow-hidden flex-1">
        <div 
          ref={scrollRef}
          className="h-full overflow-auto"
          onScroll={handleScroll}
        >
          <Table>
            <TableHeader className="bg-[#0F151F] sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-[#1E2530] hover:bg-[#1E2530]">
                  {headerGroup.headers.map((header) => {
                    // Determine alignment based on column
                    const isExchange = header.column.id === 'exchange'
                    const isNumeric = ['current_price', 'change', 'changePercent'].includes(header.column.id)
                    
                    const alignClass = isExchange 
                      ? 'text-left justify-start' 
                      : isNumeric 
                        ? 'text-right justify-end' 
                        : 'text-center justify-center'
                    
                    return (
                      <TableHead
                        key={header.id}
                        className={`text-[#F8FAFC] text-xs cursor-pointer hover:bg-[#1E2530] bg-[#0F151F] font-semibold ${alignClass}`}
                        onClick={header.column.getToggleSortingHandler()}
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
                    className="bg-[#7588A31A] hover:bg-[#292D33]/80 border-[#1E2530] cursor-pointer h-10"
                    onClick={() => {
                      const stock = row.original as { symbol: string }
                      navigate(`/symbols/${encodeURIComponent(stock.symbol.replace(':', '-'))}`)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
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
          </Table>
          
          {/* Loading more indicator */}
          {loadingMore && (
            <div className="text-center py-4 text-[#7588A3]">
              Loading more...
            </div>
          )}
          
          {/* Scroll hint */}
          {displayCount < filteredData.length && !loadingMore && (
            <div className="text-center py-2 text-xs text-[#7588A3]">
              Scroll down to load more
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
