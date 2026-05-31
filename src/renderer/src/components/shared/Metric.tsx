import type { JSX } from "react";

import { formatCompactNumber } from "../../utils/format";

export function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="metric-tile">
      <strong>{formatCompactNumber(value)}</strong>
      <span>{label}</span>
    </div>
  );
}
