import { useMemo } from "react";
import { tokens } from "./tokens";

/* ===================== 阈值着色折线图（SVG，零依赖，双端可用） ===================== */

export interface ChartPoint {
  /** 时间戳（毫秒） */
  x: number;
  y: number;
}

export interface ChartSeries {
  name: string;
  points: ChartPoint[];
  color?: string;
}

export interface ChartThresholds {
  warnMin?: number | null;
  warnMax?: number | null;
  faultMin?: number | null;
  faultMax?: number | null;
}

export interface ThresholdLineChartProps {
  series: ChartSeries[];
  thresholds?: ChartThresholds;
  unit?: string;
  height?: number;
  /** y 轴强制范围 */
  yDomain?: [number, number];
  /** 点选下钻 */
  onPointClick?: (seriesName: string, point: ChartPoint) => void;
  /** 显示图例 */
  showLegend?: boolean;
}

const W = 800;
const PAD_L = 48;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 24;
const SERIES_COLORS = [tokens.primary, "#7C3AED", tokens.info, tokens.warning, tokens.textSecondary];

function fmtTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 阈值着色折线图：预警/故障区带着色 + 阈值线 + 图例 + Tooltip + 点选下钻（对齐 Grafana thresholds） */
export function ThresholdLineChart({
  series,
  thresholds,
  unit,
  height = 220,
  yDomain,
  onPointClick,
  showLegend = true,
}: ThresholdLineChartProps) {
  const H = height;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const { yMin, yMax, xMin, xMax } = useMemo(() => {
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const th = thresholds
      ? [thresholds.warnMin, thresholds.warnMax, thresholds.faultMin, thresholds.faultMax].filter(
          (v): v is number => v != null,
        )
      : [];
    const all = [...ys, ...th];
    let lo = yDomain ? yDomain[0] : all.length ? Math.min(...all) : 0;
    let hi = yDomain ? yDomain[1] : all.length ? Math.max(...all) : 1;
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const margin = (hi - lo) * 0.08;
    lo -= margin;
    hi += margin;
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    return {
      yMin: lo,
      yMax: hi,
      xMin: xs.length ? Math.min(...xs) : 0,
      xMax: xs.length ? Math.max(...xs) : 1,
    };
  }, [series, thresholds, yDomain]);

  const sx = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (y: number) => PAD_T + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / 4);
    }
    return ticks;
  }, [yMin, yMax]);

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(xMin + ((xMax - xMin) * i) / 4);
    }
    return ticks;
  }, [xMin, xMax]);

  const band = (lo: number | null | undefined, hi: number | null | undefined, color: string, key: string) => {
    if (lo == null && hi == null) return null;
    const top = sy(hi != null ? Math.min(hi, yMax) : yMax);
    const bottom = sy(lo != null ? Math.max(lo, yMin) : yMin);
    if (bottom - top < 1) return null;
    return (
      <rect
        key={key}
        x={PAD_L}
        y={top}
        width={innerW}
        height={bottom - top}
        fill={color}
        opacity={0.08}
      />
    );
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height, display: "block" }}
        role="img"
        aria-label="指标趋势图"
      >
        {/* 阈值着色带：故障（红）、预警（橙） */}
        {band(thresholds?.faultMin, thresholds?.faultMax, tokens.danger, "fault-band-low")}
        {band(Math.max(thresholds?.faultMax ?? -Infinity, thresholds?.warnMax ?? -Infinity), null, tokens.danger, "fault-band-high")}
        {band(thresholds?.warnMin, thresholds?.warnMax, tokens.warning, "warn-band")}
        {band(thresholds?.warnMax ?? null, thresholds?.faultMax ?? null, tokens.warning, "warn-high")}
        {/* 网格与 y 轴刻度 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={sy(t)} y2={sy(t)} stroke={tokens.border} strokeWidth={1} />
            <text x={PAD_L - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill={tokens.textSecondary}>
              {t.toFixed(Math.abs(yMax - yMin) < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {/* x 轴时间标签 */}
        {xTicks.map((t, i) => (
          <text key={i} x={sx(t)} y={H - 6} textAnchor="middle" fontSize={11} fill={tokens.textSecondary}>
            {fmtTime(t)}
          </text>
        ))}
        {/* 阈值参考线 */}
        {[
          { v: thresholds?.warnMax, c: tokens.warning, label: "预警上限" },
          { v: thresholds?.warnMin, c: tokens.warning, label: "预警下限" },
          { v: thresholds?.faultMax, c: tokens.danger, label: "故障上限" },
          { v: thresholds?.faultMin, c: tokens.danger, label: "故障下限" },
        ].map(
          (l, i) =>
            l.v != null &&
            l.v >= yMin &&
            l.v <= yMax && (
              <g key={i}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={sy(l.v)}
                  y2={sy(l.v)}
                  stroke={l.c}
                  strokeWidth={1.2}
                  strokeDasharray="6 4"
                />
                <text x={W - PAD_R - 2} y={sy(l.v) - 4} textAnchor="end" fontSize={10} fill={l.c}>
                  {l.label} {l.v}
                </text>
              </g>
            ),
        )}
        {/* 数据折线 */}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, pi) => (
                <circle
                  key={pi}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={onPointClick ? 3.5 : 2.5}
                  fill={color}
                  style={onPointClick ? { cursor: "pointer" } : undefined}
                  onClick={() => onPointClick?.(s.name, p)}
                >
                  <title>{`${s.name}\n${fmtTime(p.x)}\n数值 ${p.y}${unit ?? ""}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {showLegend && series.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6, fontSize: tokens.fontSm, color: tokens.textSecondary }}>
          {series.map((s, si) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden
                style={{ width: 12, height: 3, background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length], borderRadius: 2 }}
              />
              {s.name}
              {unit ? `（${unit}）` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== 环形图（健康度分布） ===================== */

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/** 环形图：中心显示总量，图例在右侧 */
export function DonutChart({ data, centerLabel, size = 150 }: { data: DonutSlice[]; centerLabel?: string; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  const arcs = data.map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const start = acc * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const end = acc * Math.PI * 2 - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const d2 = frac >= 0.999
      ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
      : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return { path: d2, ...d, frac };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={size} height={size} role="img" aria-label={centerLabel ?? "分布图"}>
        {arcs.map((a) => (
          <path key={a.name} d={a.path} fill={a.color} stroke="#fff" strokeWidth={2}>
            <title>{`${a.name}: ${a.value}（${(a.frac * 100).toFixed(0)}%）`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill={tokens.text} style={{ fontVariantNumeric: "tabular-nums" }}>
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill={tokens.textSecondary}>
          {centerLabel ?? "总计"}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: tokens.fontSm }}>
        {arcs.map((a) => (
          <span key={a.name} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: tokens.text }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: a.color }} />
            {a.name}
            <b style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{a.value}</b>
            <span style={{ color: tokens.textSecondary }}>{total > 0 ? `${((a.value / total) * 100).toFixed(0)}%` : "-"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== 横向条形图（停机风险榜） ===================== */

export interface BarItem {
  name: string;
  value: number;
  color?: string;
  unit?: string;
  onClick?: () => void;
}

/** 横向条形图（风险榜/排行），支持点击下钻 */
export function SimpleBarChart({ data, max, height = 26 }: { data: BarItem[]; max?: number; height?: number }) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => (
        <div
          key={d.name}
          onClick={d.onClick}
          style={{ display: "grid", gridTemplateColumns: "minmax(96px, 160px) 1fr 64px", alignItems: "center", gap: 10, cursor: d.onClick ? "pointer" : "default" }}
        >
          <span style={{ fontSize: tokens.fontSm, color: tokens.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.name}
          </span>
          <div style={{ background: "#EEF2F6", borderRadius: 999, height, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(2, (d.value / top) * 100)}%`,
                height: "100%",
                background: d.color ?? tokens.primary,
                borderRadius: 999,
                transition: "width .4s ease",
              }}
              title={`${d.name}: ${d.value}${d.unit ?? ""}`}
            />
          </div>
          <span style={{ fontSize: tokens.fontSm, color: tokens.textSecondary, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {d.value}
            {d.unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}