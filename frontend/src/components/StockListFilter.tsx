import { useState, useEffect } from "react";
import { HiOutlineSearch } from "react-icons/hi";
import reloadIcon from "@/assets/reload.svg";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StockFiltersProps = {
  onChange?: (filters: any) => void;
  filteredCount?: number;
  currentFilters?: any;
};

export default function StockListFilter({ onChange, filteredCount, currentFilters }: StockFiltersProps) {
  const [market, setMarket] = useState<string>("");
  const [currentRating, setCurrentRating] = useState<string>("");
  const [sector, setSector] = useState<string>("");
  const [sectors, setSectors] = useState<string[]>([]);

  const [search, setSearch] = useState<string>("");

  // Fetch available sectors on mount
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/sectors");
        if (res.ok) {
          const data = await res.json();
          setSectors(data.sectors || []);
        }
      } catch (err) {
        console.error("Failed to fetch sectors:", err);
      }
    };
    fetchSectors();
  }, []);

  // Sync local state with external filters (e.g. from SummaryInfo clicks)
  useEffect(() => {
    if (currentFilters) {
      setMarket(currentFilters.market || "");
      setCurrentRating(currentFilters.currentRating || "");
      setSector(currentFilters.sector || "");
      setSearch(currentFilters.search || "");
    }
  }, [currentFilters]);

  const ratingOptions = ["Strong Buy", "Buy", "Sell", "Strong Sell"];
  const marketOptions = ["US", "HK", "TH", "JP", "IN", "VN", "UK"];


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
    onChange?.({ market: newMarket, currentRating, sector, search });
  };

  const handleSectorSelect = (value: string) => {
    const newSector = value === "all" ? "" : value;
    setSector(newSector);
    onChange?.({ market, currentRating, sector: newSector, search });
  };

  const handleCurrentRatingSelect = (value: string) => {
    const newRating = value === "all" ? "" : value;
    setCurrentRating(newRating);
    onChange?.({ market, currentRating: newRating, sector, search });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onChange?.({ market, currentRating, sector, search: value });
  };

  const handleClearFilters = () => {
    setMarket("");
    setCurrentRating("");
    setSector("");
    onChange?.({ market: "", currentRating: "", sector: "", search: "" });
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
          <Select value={sector || "all"} onValueChange={handleSectorSelect}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px] lg:w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>{sector ? sector : "All Sectors"}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0 max-h-[300px]">
              <SelectGroup>
                <SelectItem value="all" className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                  All Sectors
                </SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s} className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none">
                    {s}
                  </SelectItem>
                ))}
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
                {ratingOptions.map((rating) => (
                  <SelectItem key={rating} value={rating} className={`text-white hover:text-white focus:text-white ${getRatingHoverColor(rating)} cursor-pointer px-3 py-2.5 rounded-none`}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>


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
            className="w-[54px] h-[40px] bg-[#0F151F] rounded-xl hover:bg-[#354052] transition flex items-center justify-center flex-shrink-0"
          >
            <img src={reloadIcon} alt="reset" />
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
