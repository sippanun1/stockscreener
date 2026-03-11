import { useState, useEffect, useRef } from "react";
import { HiOutlineSearch } from "react-icons/hi";
import { RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StockFiltersProps = {
  onChange?: (filters: any) => void;
  filteredCount?: number;
  currentFilters?: any;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function StockListFilter({ onChange, filteredCount, currentFilters }: StockFiltersProps) {
  const [market, setMarket] = useState<string>("");
  const [currentRating, setCurrentRating] = useState<string>("");
  const [previousRating, setPreviousRating] = useState<string>("");
  const [sectorsSelected, setSectorsSelected] = useState<string[]>([]);
  const [sectorsOptions, setSectorsOptions] = useState<string[]>([]);

  const [search, setSearch] = useState<string>("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch available sectors on mount
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sectors`);
        if (res.ok) {
          const data = await res.json();
          setSectorsOptions(data.sectors || []);
        }
      } catch (err) {
        console.error("Failed to fetch sectors:", err);
      }
    };
    fetchSectors();
  }, []);

  const [showFavorites, setShowFavorites] = useState<boolean>(false);
  const [breakoutScores, setBreakoutScores] = useState<string[]>([]);
  const [breakoutScoreOptions, setBreakoutScoreOptions] = useState<string[]>([]);

  // Fetch available breakout scores on mount
  useEffect(() => {
    const fetchBreakoutScores = async () => {
      try {
        const res = await fetch(`${API_URL}/api/breakout-scores`);
        if (res.ok) {
          const data = await res.json();
          setBreakoutScoreOptions((data.breakout_scores || []).map(String));
        }
      } catch (err) {
        console.error("Failed to fetch breakout scores:", err);
      }
    };
    fetchBreakoutScores();
  }, []);

  // Sync local state with external filters (e.g. from SummaryInfo clicks)
  useEffect(() => {
    if (currentFilters) {
      setMarket(currentFilters.market || "");
      setCurrentRating(currentFilters.currentRating || "");
      setPreviousRating(currentFilters.previousRating || "");
      setSectorsSelected(currentFilters.sectorsSelected || []);
      setSearch(currentFilters.search || "");
      setShowFavorites(currentFilters.favoritesOnly || false);
      setBreakoutScores(currentFilters.breakoutScores || []);
    }
  }, [currentFilters]);

  const ratingOptions = ["Strong Buy", "Buy", "Sell", "Strong Sell"];
  const marketOptions = ["US", "HK", "TH", "JP", "IN", "VN", "UK"];

  // Rating adjacency: only ±1 step transitions are valid
  const RATING_ORDER: Record<string, number> = {
    "Strong Sell": 0, "Sell": 1, "Buy": 2, "Strong Buy": 3
  };

  const isInvalidCombination = (prevR: string, curR: string) => {
    if (!prevR || !curR) return false;
    return Math.abs((RATING_ORDER[prevR] ?? -99) - (RATING_ORDER[curR] ?? -99)) > 1;
  };


  const getRatingHoverColor = (rating: string) => {
    switch (rating) {
      case "Strong Sell":
        return "hover:bg-[#A10F38] focus:bg-[#A10F38]";
      case "Sell":
        return "hover:bg-[#CE0F44] focus:bg-[#CE0F44]";
      case "Neutral":
        return "hover:bg-[#8490A7] focus:bg-[#8490A7]";
      case "Buy":
        return "hover:bg-[#007957] focus:bg-[#007957]";
      case "Strong Buy":
        return "hover:bg-[#065F46] focus:bg-[#065F46]";
      default:
        return "hover:bg-[#354052] focus:bg-[#354052]";
    }
  };

  const handleMarketSelect = (value: string) => {
    const newMarket = value === "all" ? "" : value;
    setMarket(newMarket);
    onChange?.({ market: newMarket, currentRating, previousRating, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores });
  };

  const handleSectorSelect = (value: string) => {
    setSectorsSelected((prev) => {
      const isSelected = prev.includes(value);
      const newSectors = isSelected 
        ? prev.filter((s) => s !== value)
        : [...prev, value];
      onChange?.({ market, currentRating, previousRating, sectorsSelected: newSectors, search, favoritesOnly: showFavorites, breakoutScores });
      return newSectors;
    });
  };

  const handleSelectAllSectors = () => {
    if (sectorsSelected.length === sectorsOptions.length) {
      // Deselect all
      setSectorsSelected([]);
      onChange?.({ market, currentRating, previousRating, sectorsSelected: [], search, favoritesOnly: showFavorites, breakoutScores });
    } else {
      // Select all
      setSectorsSelected(sectorsOptions);
      onChange?.({ market, currentRating, previousRating, sectorsSelected: sectorsOptions, search, favoritesOnly: showFavorites, breakoutScores });
    }
  };

  const handleCurrentRatingSelect = (value: string) => {
    const newRating = value === "all" ? "" : value;
    setCurrentRating(newRating);
    onChange?.({ market, currentRating: newRating, previousRating, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores });
  };

  const handlePreviousRatingSelect = (value: string) => {
    const newPrev = value === "all" ? "" : value;
    setPreviousRating(newPrev);
    onChange?.({ market, currentRating, previousRating: newPrev, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value); // Update local input instantly
    
    // Debounce the heavy API/table update
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      onChange?.({ market, currentRating, previousRating, sectorsSelected, search: value, favoritesOnly: showFavorites, breakoutScores });
    }, 300);
  };

  const handleFavoritesToggle = () => {
    const newShowFavorites = !showFavorites;
    setShowFavorites(newShowFavorites);
    onChange?.({ market, currentRating, previousRating, sectorsSelected, search, favoritesOnly: newShowFavorites, breakoutScores });
  };

  const handleBreakoutScoresChange = (score: string) => {
    setBreakoutScores((prev) => {
      const isSelected = prev.includes(score);
      const newScores = isSelected 
        ? prev.filter((s) => s !== score)
        : [...prev, score];
      onChange?.({ market, currentRating, previousRating, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores: newScores });
      return newScores;
    });
  };

  const handleClearFilters = () => {
    setMarket("");
    setCurrentRating("");
    setPreviousRating("");
    setSectorsSelected([]);
    setShowFavorites(false);
    setBreakoutScores([]);
    onChange?.({ market: "", currentRating: "", previousRating: "", sectorsSelected: [], search: "", favoritesOnly: false, breakoutScores: [] });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-[53px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left side - Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Markets All */}
          <Select value={market || "all"} onValueChange={handleMarketSelect}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px] lg:w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>{market ? market : "Markets All"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                <SelectItem value="all" className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                  Markets All
                </SelectItem>
                {marketOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Sector Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className={`flex gap-1 items-center h-[40px] px-4 rounded-xl text-sm font-semibold transition-colors border ${
                  sectorsSelected.length > 0
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-[#0F151F] text-[#F8FAFC] border-transparent hover:bg-[#354052]/80"
                }`}
              >
                Sector {sectorsSelected.length > 0 && `(${sectorsSelected.length})`}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] max-h-[300px] overflow-y-auto">
              <DropdownMenuCheckboxItem
                  checked={sectorsSelected.length === sectorsOptions.length && sectorsOptions.length > 0}
                  onCheckedChange={handleSelectAllSectors}
                  className="cursor-pointer hover:bg-[#7588A380] focus:bg-[#7588A380] hover:text-white focus:text-white font-semibold"
              >
                 Select all
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-[#354052]/80" />
              {sectorsOptions.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={sectorsSelected.includes(s)}
                  onCheckedChange={() => handleSectorSelect(s)}
                  className="cursor-pointer hover:bg-[#7588A380] focus:bg-[#7588A380] hover:text-white focus:text-white"
                >
                  {s}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Previous Rating */}
          <Select value={previousRating || "all"} onValueChange={handlePreviousRatingSelect}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px] lg:w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>{previousRating ? `Prev: ${previousRating}` : "Previous Rating"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                <SelectItem value="all" className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                  All
                </SelectItem>
                {ratingOptions.map((rating) => {
                  const disabled = currentRating ? isInvalidCombination(rating, currentRating) : false;
                  return (
                    <SelectItem
                      key={rating}
                      value={rating}
                      disabled={disabled}
                      className={`text-white hover:text-white focus:text-white ${disabled ? 'opacity-30 cursor-not-allowed' : `${getRatingHoverColor(rating)} cursor-pointer`} px-3 py-2.5 rounded-none`}
                    >
                      {rating}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Current Rating */}
          <Select value={currentRating || "all"} onValueChange={handleCurrentRatingSelect}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px] lg:w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>{currentRating ? currentRating : "Current Rating"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                <SelectItem value="all" className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                  All
                </SelectItem>
                {ratingOptions.map((rating) => {
                  const disabled = previousRating ? isInvalidCombination(previousRating, rating) : false;
                  return (
                    <SelectItem
                      key={rating}
                      value={rating}
                      disabled={disabled}
                      className={`text-white hover:text-white focus:text-white ${disabled ? 'opacity-30 cursor-not-allowed' : `${getRatingHoverColor(rating)} cursor-pointer`} px-3 py-2.5 rounded-none`}
                    >
                      {rating}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
          
          {/* Breakout Scores Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className={`flex gap-1 items-center h-[40px] px-4 rounded-xl text-sm font-semibold transition-colors border ${
                  breakoutScores.length > 0
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-[#0F151F] text-[#F8FAFC] border-transparent hover:bg-[#354052]/80"
                }`}
              >
                Breakout {breakoutScores.length > 0 && `(${breakoutScores.length})`}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[150px]">
              <DropdownMenuCheckboxItem
                  checked={breakoutScores.length === breakoutScoreOptions.length && breakoutScoreOptions.length > 0}
                  onCheckedChange={() => {
                    if (breakoutScores.length === breakoutScoreOptions.length) {
                      setBreakoutScores([]);
                      onChange?.({ market, currentRating, previousRating, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores: [] });
                    } else {
                      setBreakoutScores([...breakoutScoreOptions]);
                      onChange?.({ market, currentRating, previousRating, sectorsSelected, search, favoritesOnly: showFavorites, breakoutScores: [...breakoutScoreOptions] });
                    }
                  }}
                  className="cursor-pointer hover:bg-[#7588A380] focus:bg-[#7588A380] hover:text-white focus:text-white font-semibold"
              >
                 Select all
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-[#354052]/80" />
              {breakoutScoreOptions.map((score) => (
                <DropdownMenuCheckboxItem
                  key={score}
                  checked={breakoutScores.includes(score)}
                  onCheckedChange={() => handleBreakoutScoresChange(score)}
                  className="cursor-pointer hover:bg-[#7588A380] focus:bg-[#7588A380] hover:text-white focus:text-white"
                >
                  Score {score}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Action Toggle (Favorites) */}
          <button
             onClick={handleFavoritesToggle}
             className={`h-[40px] px-4 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border ${
                showFavorites 
                ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/20" 
                : "bg-[#0F151F] text-[#F8FAFC] border-transparent hover:bg-[#354052]/80"
             }`}
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={showFavorites ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
             Watchlist
          </button>

        </div>
        {/* Right side - Search & Clear */}
        <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F8FAFC] text-lg" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="search"
              className="w-full lg:w-[200px] bg-[#0F151F] border border-[#7588A3]/30 text-[#F8FAFC] pl-10 pr-3 py-2 rounded-xl text-sm placeholder-[#F8FAFC] focus:outline-none focus:border-[#7588A3]"
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="w-[54px] h-[40px] bg-[#0F151F] rounded-xl hover:bg-[#354052] transition flex items-center justify-center flex-shrink-0 group"
          >
            <RotateCcw className="text-[#F8FAFC] w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      {/* Signal Change Count */}
      <div className="mt-3 sm:mt-4 text-[#F8FAFC]">
        <span className="text-xs sm:text-sm">Total Signal: </span>
        <span className="text-base sm:text-lg font-bold text-[#00FFB7]">
          {filteredCount?.toLocaleString() || 0}
        </span>
        <span className="text-xs sm:text-sm text-[#7588A3] ml-2">stocks in table</span>
      </div>
    </div>
  );
}
