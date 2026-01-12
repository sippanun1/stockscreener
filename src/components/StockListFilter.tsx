import { useState } from "react";
import { HiOutlineSearch } from "react-icons/hi";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

type StockFiltersProps = {
  onChange?: (filters: any) => void;
};

export default function StockListFilter({ onChange }: StockFiltersProps) {
  const [market, setMarket] = useState<string>("");
  const [previousRating, setPreviousRating] = useState<string>("");
  const [currentRating, setCurrentRating] = useState<string>("");
  const [technicalRating, setTechnicalRating] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState<string>("");

  const ratingOptions = ["Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"];
  const marketOptions = ["US", "HK", "TH", "JP"];
  const technicalRatingOptions = ["Positive", "Negative"];

  // Helper function to get hover color for each rating
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
    onChange?.({
      market: newMarket,
      previousRating,
      currentRating,
      technicalRating,
      date: date ? format(date, "yyyy-MM-dd") : "",
      search,
    });
  };

  const handlePreviousRatingSelect = (value: string) => {
    const newRating = value === "all" ? "" : value;
    setPreviousRating(newRating);
    onChange?.({
      market,
      previousRating: newRating,
      currentRating,
      technicalRating,
      date: date ? format(date, "yyyy-MM-dd") : "",
      search,
    });
  };

  const handleCurrentRatingSelect = (value: string) => {
    const newRating = value === "all" ? "" : value;
    setCurrentRating(newRating);
    onChange?.({
      market,
      previousRating,
      currentRating: newRating,
      technicalRating,
      date: date ? format(date, "yyyy-MM-dd") : "",
      search,
    });
  };

  const handleTechnicalRatingSelect = (value: string) => {
    const newRating = value === "all" ? "" : value;
    setTechnicalRating(newRating);
    onChange?.({
      market,
      previousRating,
      currentRating,
      technicalRating: newRating,
      date: date ? format(date, "yyyy-MM-dd") : "",
      search,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onChange?.({
      market,
      previousRating,
      currentRating,
      technicalRating,
      date: date ? format(date, "yyyy-MM-dd") : "",
      search: value,
    });
  };

  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    onChange?.({
      market,
      previousRating,
      currentRating,
      technicalRating,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
      search,
    });
  };

  const handleClearFilters = () => {
    setMarket("");
    setPreviousRating("");
    setCurrentRating("");
    setTechnicalRating("");
    setDate(undefined);
    setSearch("");
    onChange?.({
      market: "",
      previousRating: "",
      currentRating: "",
      technicalRating: "",
      date: "",
      search: "",
    });
  };

  return (
    <div className="ml-[53px] mr-[53px]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
        {/* Markets All */}
        <div className="relative">
          <Select value={market || "all"} onValueChange={handleMarketSelect}>
            <SelectTrigger className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>
                {market ? market : "Markets All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                <SelectItem 
                  value="all"
                  className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none"
                >
                  Markets All
                </SelectItem>
                {marketOptions.map((option) => (
                  <SelectItem 
                    key={option} 
                    value={option}
                    className="text-white hover:text-white focus:text-white hover:bg-[#7588A380] focus:bg-[#7588A380] cursor-pointer px-3 py-2.5 rounded-none"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Previous Rating */}
        <div className="relative right-3.5">
          <Select value={previousRating || "all"} onValueChange={handlePreviousRatingSelect}>
            <SelectTrigger className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>
                {previousRating ? previousRating : "Previous Rating"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                {ratingOptions.map((rating) => (
                  <SelectItem 
                    key={rating} 
                    value={rating}
                    className={`text-white hover:text-white focus:text-white ${getRatingHoverColor(rating)} cursor-pointer py-2.5 pl-3 pr-10 rounded-none relative`}
                  >
                    <div className="flex items-center">
                      <span>{rating}</span>
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">→</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Current Rating */}
        <div className="relative right-7">
          <Select value={currentRating || "all"} onValueChange={handleCurrentRatingSelect}>
            <SelectTrigger className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>
                {currentRating ? currentRating : "Current Rating"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                {ratingOptions.map((rating) => (
                  <SelectItem 
                    key={rating} 
                    value={rating}
                    className={`text-white hover:text-white focus:text-white ${getRatingHoverColor(rating)} cursor-pointer px-3 py-2.5 rounded-none`}
                  >
                    {rating}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Technical Rating */}
        <div className="relative right-10.5">
          <Select value={technicalRating || "all"} onValueChange={handleTechnicalRatingSelect}>
            <SelectTrigger className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] border-0 rounded-xl text-sm font-semibold hover:bg-[#354052]/80 transition">
              <SelectValue>
                {technicalRating ? technicalRating : "Rating Change"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#171E2D] border-0 text-[#F8FAFC] min-w-[200px] [&>*]:p-0">
              <SelectGroup>
                {technicalRatingOptions.map((rating) => (
                  <SelectItem 
                    key={rating} 
                    value={rating}
                    className="text-white hover:text-white focus:text-white hover:bg-[#354052] focus:bg-[#354052] cursor-pointer px-3 py-2.5 rounded-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xl ${rating === "Positive" ? "text-[#00FFB7]" : "text-[#FF3069]"}`}>●</span>
                      <span>{rating}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Date Picker */}
        <div className="relative right-14">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm font-semibold flex items-center justify-center hover:bg-[#354052]/80 transition">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMM dd") : "MM/DD/YYYY"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-[#0F151F] border-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                initialFocus
                className="text-white"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Search */}
        <div className="relative left-35">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F8FAFC] text-lg" />
          <input
            type="text" 
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="search"
            className="
              w-full
              bg-[#0F151F]
              border border-[#7588A3]/30
              text-[#F8FAFC]
              pl-10 pr-3 py-2
              rounded-xl
              text-sm
              placeholder-[#F8FAFC]
              focus:outline-none
              focus:border-[#7588A3]
            "
          />
        </div>

        {/* Clear Filters Button */}
        <div className="relative left-35">
          <button
            onClick={handleClearFilters}
            className="w-[54px] h-[40px] bg-[#0F151F] rounded-xl hover:bg-[#354052] transition flex items-center justify-center"
          >
            <img src="/src/assets/SVG.svg" alt="reset" />
          </button>
        </div>
      </div>
    </div>
  );
}
