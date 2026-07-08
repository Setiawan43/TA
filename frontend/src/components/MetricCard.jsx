import React from "react";

function MetricCard({ label, value, subtext, trend, isTrendUp }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {subtext && (
        <span className="metric-subtext">
          {trend && (
            <span className={isTrendUp ? "metric-trend-up" : "metric-trend-down"}>
              {trend}{" "}
            </span>
          )}
          {subtext}
        </span>
      )}
    </div>
  );
}

export default MetricCard;
