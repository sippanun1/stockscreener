import { useState } from "react";
import { HiOutlineSearch } from "react-icons/hi";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";



type StockFiltersProps = {
  onChange?: (filters: any) => void;
};

export default function StockListFilter({ onChange }: StockFiltersProps) {
  const [market, setMarket] = useState<string>("");
  const [previousRating, setPreviousRating] = useState<string>("");
  const [currentRating, setCurrentRating] = useState<string>("");
  const [technicalRating, setTechnicalRating] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [showMarketsDropdown, setShowMarketsDropdown] = useState(false);
  const [showPreviousRatingDropdown, setShowPreviousRatingDropdown] = useState(false);
  const [showCurrentRatingDropdown, setShowCurrentRatingDropdown] = useState(false);
  const [showTechnicalRatingDropdown, setShowTechnicalRatingDropdown] = useState(false);
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState(false);

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
      technicalRating,
      date,
      search: value,
    });
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setShowDatePickerDropdown(false);
    onChange?.({
      market,
      previousRating,
      currentRating,
      technicalRating,
      date: value,
      search,
    });
  };

  const handleClearFilters = () => {
    setMarket("");
    setPreviousRating("");
    setCurrentRating("");
    setTechnicalRating("");
    setDate("");
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
          <button 
            onClick={() => setShowMarketsDropdown(!showMarketsDropdown)}
            className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {market || "Markets All"}
            <img src="/src/assets/Vector.svg" alt="Vector" className="ml-2 mt-1" />
          </button>
          {showMarketsDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-[#171E2D] rounded shadow-lg z-50">
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
        <div className="relative right-3.5">
          <button 
            onClick={() => setShowPreviousRatingDropdown(!showPreviousRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {previousRating || "Previous Rating"}
            <img src="/src/assets/Vector.svg" alt="Vector" className="ml-2 mt-1" />
          </button>
          {showPreviousRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-[#171E2D] rounded shadow-lg z-50">
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
        <div className="relative right-7">
          <button 
            onClick={() => setShowCurrentRatingDropdown(!showCurrentRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {currentRating || "Current Rating"}
            <img src="/src/assets/Vector.svg" alt="Vector" className="ml-2 mt-1" />
          </button>
          {showCurrentRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-[#171E2D] rounded shadow-lg z-50">
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
        <div className="relative right-10.5">
          <button 
            onClick={() => setShowTechnicalRatingDropdown(!showTechnicalRatingDropdown)}
            className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            {technicalRating || "Rating Change"}
            <img src="/src/assets/Vector.svg" alt="Vector" className="ml-2 mt-1" />
          </button>
          {showTechnicalRatingDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-[#171E2D] rounded shadow-lg z-50 border-0.5">
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

        {/* Date Picker */}
        <div className="relative right-14">
          <button 
            onClick={() => setShowDatePickerDropdown(!showDatePickerDropdown)}
            className="w-[172px] h-[40px] bg-[#0F151F] text-[#F8FAFC] rounded-xl text-sm flex items-center justify-center hover:bg-[#354052]/80 transition"
          >
            <img src="/src/assets/date.svg" alt="calendar" className="mr-2" />
            {date ? format(new Date(date), "MMM dd") : "DD/MM/YYYY"}

          </button>
          {showDatePickerDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-[#171E2D] rounded shadow-lg z-50 p-4 w-80">
              <DayPicker
                mode="single"
                selected={date ? new Date(date) : undefined}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    const formattedDate = format(selectedDate, "yyyy-MM-dd");
                    handleDateChange(formattedDate);
                  }
                }}
                classNames={{
                  caption:
                    "flex justify-between items-center mb-4",

                  caption_label:
                    "text-center text-[#F8FAFC] text-sm font-semibold flex-1",

                  nav:
                    "flex gap-2",

                  nav_button:
                    "h-7 w-7 bg-[#1F2A3B] hover:bg-[#354052] text-[#F8FAFC] rounded flex items-center justify-center transition",

                  nav_button_previous:
                    "",

                  nav_button_next:
                    "",
                }}
              />
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
              bg-[#0F151F]
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
            className="w-[54px] h-[40px] bg-[#0F151F] rounded-xl hover:bg-[#354052] transition flex items-center justify-center"
          >
            <img src="/src/assets/SVG.svg" alt="reset" />
          </button>
        </div>
      </div>
    </div>
  );
}
