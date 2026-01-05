import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type DataPoint = {
  date: string;
  winRate: number;
};

type WinRateChartProps = {
  data: DataPoint[];
};

export default function WinRateChart({ data }: WinRateChartProps) {
  return (
    <div className="bg-[#0F151F] rounded-lg border border-[#7588A3]/20 mx-[53px] mb-8 p-6">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00A67E" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#00A67E" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7588A3", fontSize: 12 }}
            dy={10}
          />
          <YAxis
            domain={[50, 85]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7588A3", fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
            dx={-10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid rgba(117, 136, 163, 0.3)",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            }}
            labelStyle={{ color: "#F8FAFC", fontWeight: "bold" }}
            itemStyle={{ color: "#00FF88" }}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, "Win Rate"]}
          />
          <Area
            type="monotone"
            dataKey="winRate"
            stroke="#00FF88"
            strokeWidth={2}
            fill="url(#winRateGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
