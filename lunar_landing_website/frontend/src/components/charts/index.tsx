/**
 * Reusable Recharts wrappers, themed to the LunaNav palette.
 * All charts render null/undefined values as gaps — never as zero.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS } from "@/lib/constants";
import { DASH } from "@/lib/format";

const AXIS = { stroke: CHART_COLORS.axis, fontSize: 10, fontFamily: "IBM Plex Mono" };
const TOOLTIP_STYLE = {
  backgroundColor: "#07111F",
  border: "1px solid #1B2C49",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
  color: "#F4F6F8",
};

function fmtTime(value: string): string {
  // "2026-Nov-15 06:00" or ISO → short label
  const m = value.match(/(\d{4})-(\w{3})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[3]} ${m[2]} ${m[4]}:${m[5]}`;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(5, 16).replace("T", " ");
  }
  return value;
}

export interface SeriesPoint {
  time: string;
  [key: string]: number | string | null;
}

export function AzElChart({
  data,
  height = 260,
  showEarth = true,
}: {
  data: SeriesPoint[];
  height?: number;
  showEarth?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={fmtTime} {...AXIS} minTickGap={30} />
        <YAxis yAxisId="az" domain={[0, 360]} {...AXIS} label={{ value: "Az°", ...AXIS, angle: -90, position: "insideLeft" }} />
        <YAxis yAxisId="el" orientation="right" domain={[-90, 90]} {...AXIS} label={{ value: "El°", ...AXIS, angle: 90, position: "insideRight" }} />
        <ReferenceLine yAxisId="el" y={0} stroke="#5A7699" strokeDasharray="4 4" />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => fmtTime(String(v))} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line yAxisId="az" type="monotone" dataKey="sunAz" name="Sun az" stroke={CHART_COLORS.sun} dot={false} strokeWidth={1.6} connectNulls={false} />
        <Line yAxisId="el" type="monotone" dataKey="sunEl" name="Sun el" stroke={CHART_COLORS.sun} strokeDasharray="4 3" dot={false} strokeWidth={1.4} connectNulls={false} />
        {showEarth ? (
          <>
            <Line yAxisId="az" type="monotone" dataKey="earthAz" name="Earth az" stroke={CHART_COLORS.earth} dot={false} strokeWidth={1.6} connectNulls={false} />
            <Line yAxisId="el" type="monotone" dataKey="earthEl" name="Earth el" stroke={CHART_COLORS.earth} strokeDasharray="4 3" dot={false} strokeWidth={1.4} connectNulls={false} />
          </>
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PowerChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.5} />
            <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={fmtTime} {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => fmtTime(String(v))} />
        <Area
          type="monotone"
          dataKey="powerW"
          name="Est. power (W)"
          stroke={CHART_COLORS.gold}
          fill="url(#powerFill)"
          strokeWidth={1.6}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SubScoreRadar({
  data,
  height = 260,
}: {
  data: { label: string; score: number | null }[];
  height?: number;
}) {
  const radarData = data.map((d) => ({ label: d.label, score: d.score ?? 0, hasValue: d.score !== null }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData} outerRadius="70%">
        <PolarGrid stroke={CHART_COLORS.grid} />
        <PolarAngleAxis dataKey="label" tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.axis, fontSize: 9 }} angle={90} />
        <Radar dataKey="score" stroke={CHART_COLORS.gold} fill={CHART_COLORS.gold} fillOpacity={0.35} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function SubScoreBars({
  data,
  height = 240,
}: {
  data: { label: string; score: number | null; weight?: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} {...AXIS} />
        <YAxis type="category" dataKey="label" width={92} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="score" name="Sub-score" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.score === null
                  ? "#334155"
                  : d.score >= 80
                    ? "#34D399"
                    : d.score >= 65
                      ? "#D5B77A"
                      : d.score >= 50
                        ? "#FBBF24"
                        : d.score >= 35
                          ? "#FB923C"
                          : "#F87171"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComparisonBars({
  data,
  height = 300,
}: {
  data: { name: string; composite: number | null; illumination?: number | null; terrain?: number | null; communication?: number | null }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis dataKey="name" {...AXIS} interval={0} angle={-12} textAnchor="end" height={54} />
        <YAxis domain={[0, 100]} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="composite" name="Composite" fill={CHART_COLORS.gold} radius={[3, 3, 0, 0]} />
        <Bar dataKey="illumination" name="Illumination" fill="#FBBF24" radius={[3, 3, 0, 0]} />
        <Bar dataKey="terrain" name="Terrain" fill="#6FA8DC" radius={[3, 3, 0, 0]} />
        <Bar dataKey="communication" name="Comms" fill="#34D399" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export { fmtTime, DASH };
