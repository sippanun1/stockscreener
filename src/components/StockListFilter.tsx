import { useState } from "react";
import { Button } from "flowbite-react";
import { HiOutlineSearch } from "react-icons/hi";

type StockFiltersProps = {
  onChange?: (filters: any) => void;
};

export default function StockListFilter({ onChange }: StockFiltersProps) {
  const [market, setMarket] = useState<string>("");
  const [previousRating, setPreviousRating] = useState<string>("");
  const [currentRating, setCurrentRating] = useState<string>("");
  const [technicalRating, setTechnicalRating] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [showMarketsDropdown, setShowMarketsDropdown] = useState(false);
  const [showPreviousRatingDropdown, setShowPreviousRatingDropdown] = useState(false);
  const [showCurrentRatingDropdown, setShowCurrentRatingDropdown] = useState(false);
  const [showTechnicalRatingDropdown, setShowTechnicalRatingDropdown] = useState(false);

  const ratingOptions = ["Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"];
  const marketOptions = ["US", "HK", "TH", "JP"];
  const technicalRatingOptions = ["Positive", "Negative"];

  const handleMarketSelect = (value: string) => {
    const newMarket = market === value ? "" : value;
    setMarket(newMarket);
    setShowMarketsDropdown(false);
    onChange?.({
      market: newMarket,
      previousRating,
      currentRating,
      search,
    });
  };

  const handlePreviousRatingSelect = (value: string) => {
    const newRating = previousRating === value ? "" : value;
    setPreviousRating(newRating);
    setShowPreviousRatingDropdown(false);
    onChange?.({
      market,
      previousRating: newRating,
      currentRating,
      search,
    });
  };

  const handleCurrentRatingSelect = (value: string) => {
    const newRating = currentRating === value ? "" : value;
    setCurrentRating(newRating);
    setShowCurrentRatingDropdown(false);
    onChange?.({
      market,
      previousRating,
      currentRating: newRating,
      technicalRating,
      search,
    });
  };

  const handleTechnicalRatingSelect = (value: string) => {
    const newRating = technicalRating === value ? "" : value;
    setTechnicalRating(newRating);
    setShowTechnicalRatingDropdown(false);
    onChange?.({
      market,
      previousRating,
      currentRating,
      technicalRating: newRating,
      search,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onChange?.({
      market,
      previousRating,
      currentRating,
      search: value,
    });
  };

  const handleClearFilters = () => {
    setMarket("");
    setPreviousRating("");
    setCurrentRating("");
    setTechnicalRating("");
    setSearch("");
    onChange?.({
      market: "",
      previousRating: "",
      currentRating: "",
      technicalRating: "",
      search: "",
    });
  };

  return (
    <div className="ml-[53px] mr-[53px]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Markets All */}
        <div className="relative">
          <button 
            onClick={() => setShowMarketsDropdown(!showMarketsDropdown)}
            className="w-[172px] h-[40px] bg-[#354052] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {market || "Markets"}
            <span className="ml-2">▼</span>
          </button>
          {showMarketsDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#171E2D] rounded shadow-lg z-10">
              {marketOptions.map((option) => (
                <div
                  key={option}
                  onClick={() => handleMarketSelect(option)}
                  className={`px-3 py-2 cursor-pointer text-[#F8FAFC] text-sm hover:bg-[#354052] ${
                    market === option ? "bg-[#354052]" : ""
                  }`}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Previous Rating */}
        <div className="relative">
          <button 
            onClick={() => setShowPreviousRatingDropdown(!showPreviousRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#354052] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {previousRating || "Previous Rating"}
            <span className="ml-2">▼</span>
          </button>
          {showPreviousRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#171E2D] rounded shadow-lg z-10">
              {ratingOptions.map((rating) => (
                <div
                  key={rating}
                  onClick={() => handlePreviousRatingSelect(rating)}
                  className={`px-3 py-2 cursor-pointer text-[#F8FAFC] text-sm hover:bg-[#354052] ${
                    previousRating === rating ? "bg-[#354052]" : ""
                  }`}
                >
                  {rating}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Rating */}
        <div className="relative">
          <button 
            onClick={() => setShowCurrentRatingDropdown(!showCurrentRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#354052] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {currentRating || "Current Rating"}
            <span className="ml-2">▼</span>
          </button>
          {showCurrentRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#171E2D] rounded shadow-lg z-10">
              {ratingOptions.map((rating) => (
                <div
                  key={rating}
                  onClick={() => handleCurrentRatingSelect(rating)}
                  className={`px-3 py-2 cursor-pointer text-[#F8FAFC] text-sm hover:bg-[#354052] ${
                    currentRating === rating ? "bg-[#354052]" : ""
                  }`}
                >
                  {rating}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical Rating */}
        <div className="relative">
          <button 
            onClick={() => setShowTechnicalRatingDropdown(!showTechnicalRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#354052] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {technicalRating || "Rating Change"}
            <span className="ml-2">▼</span>
          </button>
          {showTechnicalRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#171E2D] rounded shadow-lg z-10">
              {technicalRatingOptions.map((rating) => (
                <div
                  key={rating}
                  onClick={() => handleTechnicalRatingSelect(rating)}
                  className={`px-3 py-2 cursor-pointer text-[#F8FAFC] text-sm hover:bg-[#354052] ${
                    technicalRating === rating ? "bg-[#354052]" : ""
                  }`}
                >
                  {rating}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative left-35">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7588A3] text-lg" />

          <input
            type="text" 
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="search"
            className="
              w-full
              bg-[#354052]
              border border-[#7588A3]/30
              text-[#F8FAFC]
              pl-10 pr-3 py-2
              rounded-xl
              text-sm
              placeholder-[#7588A3]
              focus:outline-none
              focus:border-[#7588A3]
            "
          />
        </div>

        {/* Clear Filters Button */}
        <div className="relative left-35">
          <button
            onClick={handleClearFilters}
            className="w-[54px] h-[40px] bg-[#D32F2F] text-[#F8FAFC] rounded-xl text-sm font-semibold hover:bg-[#B71C1C] transition"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
