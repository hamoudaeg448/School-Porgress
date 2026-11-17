import { bandOf, fmt } from "@/lib/analytics";

// A horizontal bar for a percentage, with an optional tick for the class average.
export default function ScoreBar({ value, marker, label }) {
  const clamp = (n) => Math.max(0, Math.min(100, n));
  return (
    <div
      className="scorebar"
      role="img"
      aria-label={`${label}: ${fmt(value)}${marker != null ? `, class average ${fmt(marker)}` : ""}`}
    >
      <div className={`fill ${bandOf(value)}`} style={{ width: `${clamp(value)}%` }} />
      {marker != null && <span className="marker" style={{ left: `${clamp(marker)}%` }} />}
    </div>
  );
}
