"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TimelinePoint {
  postOpDay: number;
  self: number | null;
  clinic: number | null;
}

export interface PainPoint {
  postOpDay: number;
  rest: number;
  movement: number;
}

/**
 * Range of motion against post-operative day.
 *
 * Self-measured and clinic-measured points are drawn as two separate series with different
 * marks, never merged into one line. Averaging a paper goniometer reading taken one handed
 * with a therapist's clinic measurement would produce a smooth curve that means nothing.
 */
export function RomChart({ data }: { data: TimelinePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="postOpDay"
            name="Post-op day"
            stroke="var(--color-ink-muted)"
            fontSize={12}
            label={{ value: "Post-operative day", position: "insideBottom", offset: -12, fontSize: 12 }}
          />
          <YAxis
            type="number"
            name="TAM"
            stroke="var(--color-ink-muted)"
            fontSize={12}
            label={{ value: "TAM (degrees)", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Legend verticalAlign="top" height={28} />
          <Scatter
            name="Self-measured at home"
            data={data.filter((point) => point.self !== null).map((p) => ({ postOpDay: p.postOpDay, value: p.self }))}
            dataKey="value"
            fill="var(--color-self-measured)"
            shape="circle"
          />
          <Scatter
            name="Measured in clinic"
            data={data.filter((point) => point.clinic !== null).map((p) => ({ postOpDay: p.postOpDay, value: p.clinic }))}
            dataKey="value"
            fill="var(--color-clinic-measured)"
            shape="diamond"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PainChart({ data }: { data: PainPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="postOpDay"
            stroke="var(--color-ink-muted)"
            fontSize={12}
            label={{ value: "Post-operative day", position: "insideBottom", offset: -12, fontSize: 12 }}
          />
          <YAxis domain={[0, 10]} stroke="var(--color-ink-muted)" fontSize={12} />
          <Tooltip />
          <Legend verticalAlign="top" height={28} />
          <Line
            type="monotone"
            dataKey="rest"
            name="Pain at rest"
            stroke="var(--color-outreach)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="movement"
            name="Pain on movement"
            stroke="var(--color-review)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
