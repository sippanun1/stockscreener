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
  if (!rating) return "bg-[#354052]";
  switch (rating) {
    case "Strong Buy":
      return "bg-[#065F46]";
    case "Buy":
      return "bg-[#007957]";
    case "Neutral":
      return "bg-[#6B7280]";
    case "Sell":
      return "bg-[#CE0F44]";
    case "Strong Sell":
      return "bg-[#A10F38]";
    default:
      return "bg-[#6B7280]";
  }
};

export default function StockTable({ stocks }: StockTableProps) {
  const calculateChange = (stock: Stock) => {
    if (!stock.previous_price) return 0;
    return stock.current_price - stock.previous_price;
  };

  const calculateChangePercent = (stock: Stock) => {
    if (!stock.previous_price) return 0;
    return ((stock.current_price - stock.previous_price) / stock.previous_price) * 100;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[#10B981]";
    if (change < 0) return "text-[#EF4444]";
    return "text-[#7588A3]";
  };

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
                      ${Number(s.current_price).toFixed(2)}
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
                        s.Yesterday_Rating
                      )} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                    >
                      {s.Yesterday_Rating || "N/A"}
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
                      )} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                    >
                      {s.Technical_Rating}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[#7588A3]">
                  <div className="flex justify-center">
                    <div className="truncate w-[100px]"></div>
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
