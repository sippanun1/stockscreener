import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import type { Stock } from "../types/stock";

type StockTableProps = {
  stocks: Stock[];
};

const getRatingColor = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]";
  switch (rating) {
    case "Strong Buy":
      return "text-[#065F46]";
    case "Buy":
      return "text-[#007957]";
    case "Neutral":
      return "text-[#6B7280]";
    case "Sell":
      return "text-[#CE0F44]";
    case "Strong Sell":
      return "text-[#A10F38]";
    default:
      return "text-[#6B7280]";
  }
};

const getCurrencySymbol = (market: string) => {
  switch (market.toUpperCase()) {
    case "TH":
      return "฿";
    case "HK":
      return "HK$";
    case "JP":
      return "¥";
    case "US":
      return "$";
    default:
      return "$";
  }
};

export default function StockTable({ stocks }: StockTableProps) {
  const calculateChange = (stock: Stock) => {
    if (!stock.yesterday_price) return 0;
    return stock.current_price - stock.yesterday_price;
  };

  const calculateChangePercent = (stock: Stock) => {
    if (!stock.yesterday_price) return 0;
    return ((stock.current_price - stock.yesterday_price) / stock.yesterday_price) * 100;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[#10B981]";
    if (change < 0) return "text-[#EF4444]";
    return "text-[#7588A3]";
  };

  function findPreviousRating(
  history: {
    Technical_Rating: string;
    fetched_at: string;
    fetched_at_epoch: number;
  }[]
) {
  const sorted = [...history].sort(
    (a, b) => a.fetched_at_epoch - b.fetched_at_epoch
  );

  const current = sorted[sorted.length - 1].Technical_Rating;

  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].Technical_Rating !== current) {
      return {
        previous_rating: sorted[i].Technical_Rating,
        previous_rating_date: sorted[i].fetched_at,
      };
    }
  }

  return {
    previous_rating: "N/A",
    previous_rating_date: "N/A",
  };
}


  return (
    <div className="ml-[53px] mr-[53px] mt-[17px]">
      <Table className="table-fixed w-full">
        <TableHead className="bg-[#0F151F]">
          <TableRow>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Symbol
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Exchange
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Price
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Change
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Change%
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Previous Rating
            </TableHeadCell>
            <TableHeadCell className="p-0 w-[40px]">
              <img src="/src/assets/arrow.svg" alt="arrow" className="pl-1.5"/>
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
               Current Rating
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Date
            </TableHeadCell>
            <TableHeadCell className="text-[#F8FAFC] uppercase text-xs text-center">
              Backtest Accuracy (5D)
            </TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stocks.map((s, i) => {
            const change = calculateChange(s);
            const changePercent = calculateChangePercent(s);
            const previousRatingInfo = s.history ? findPreviousRating(s.history) : { previous_rating: "N/A", previous_rating_date: "N/A" };

            return (
              <TableRow
                key={i}
                className="bg-[#7588A31A] hover:bg-[#292D33]/80 border-b border-white/5 h-10"
              >
                <TableCell className="text-[#F8FAFC] font-semibold">
                  <div className="flex justify-center">
                    <div>{s.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-[#7588A3]">
                  <div className="flex justify-center">
                    <div className="truncate w-[100px]">{s.symbol.split(':')[0]}</div>
                  </div>
                </TableCell>
                <TableCell className="text-[#F8FAFC]">
                  <div className="flex justify-center">
                    <div className="text-right w-[100px]">
                      {getCurrencySymbol(s.market)}{Number(s.current_price).toFixed(2)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={getChangeColor(change)}>
                  <div className="flex justify-center">
                    <div className="text-right w-[100px]">
                      {change > 0 ? "+" : ""}{change.toFixed(2)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={getChangeColor(changePercent)}>
                  <div className="flex justify-center">
                    <div className="text-right w-[100px]">
                      {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex justify-center">
                    <div
                      className={`w-[91px] h-[20px] mt-1 mb-1 ${getRatingColor(
                        previousRatingInfo.previous_rating
                      )} rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                    >
                      {previousRatingInfo.previous_rating}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-0 w-[40px]">
                  <div className="flex justify-center items-center text-[#F8FAFC] text-xl">
                   <img src="/src/assets/arrow.svg" alt="arrow" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <div
                      className={`w-[91px] h-[20px] mt-1 mb-1 ${getRatingColor(
                        s.Technical_Rating
                      )} rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                    >
                      {s.Technical_Rating}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[#7588A3]">
                  <div className="flex justify-center">
                    <div className="truncate w-[100px]">{previousRatingInfo.previous_rating_date}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center items-center text-[#F8FAFC] text-xl">
                
                  </div>
                </TableCell>
                
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
