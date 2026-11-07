import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { NormalizedRecord } from '../../../types';
import { THEME } from '../../../constants/rules';
import { calcTemporalGroups } from '../../../lib/stats';
import Card from '../../ui/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineChartProps {
  records: NormalizedRecord[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    backgroundColor: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: '0.375rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    color: THEME.textPrimary,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    minWidth: '180px',
  };

  const labelStyle: React.CSSProperties = {
    color: THEME.textMuted,
    fontSize: '0.75rem',
    marginBottom: '0.25rem',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    color: THEME.textMuted,
    fontSize: '0.8125rem',
  };

  const valueStyle: React.CSSProperties = {
    color: THEME.textPrimary,
    fontWeight: 600,
  };

  return (
    <div style={containerStyle} role="tooltip">
      <div style={labelStyle}>{label}</div>
      <div style={rowStyle}>
        <span>Eventos</span>
        <span style={valueStyle}>{payload[0].value}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const NoTimestampState: React.FC = () => (
  <div
    style={{
      height: 280,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: THEME.textMuted,
      fontSize: '0.9375rem',
      textAlign: 'center',
      padding: '1rem',
    }}
    aria-live="polite"
  >
    El archivo no contiene información de fecha/hora
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TimelineChart: React.FC<TimelineChartProps> = ({ records }) => {
  const buckets = useMemo(() => calcTemporalGroups(records), [records]);

  // Determine if labels should be rotated (more than 8 buckets)
  const rotateLabels = buckets.length > 8;

  if (buckets.length === 0) {
    return (
      <Card title="Evolución temporal de eventos">
        <NoTimestampState />
      </Card>
    );
  }

  // Recharts data format
  const chartData = buckets.map((b) => ({
    label: b.label,
    count: b.count,
  }));

  const xAxisProps: React.ComponentProps<typeof XAxis> = {
    dataKey: 'label',
    stroke: THEME.textMuted,
    tick: {
      fill: THEME.textMuted,
      fontSize: 11,
    },
    tickLine: false,
    axisLine: { stroke: THEME.border },
    ...(rotateLabels
      ? {
          angle: -45,
          textAnchor: 'end' as const,
          height: 60,
          interval: 'preserveStartEnd' as const,
        }
      : {
          interval: 0,
        }),
  };

  return (
    <Card title="Evolución temporal de eventos">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: rotateLabels ? 40 : 8 }}
          aria-label="Gráfico de evolución temporal de eventos"
        >
          <defs>
            <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={THEME.accent}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={THEME.accent}
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={THEME.border}
            vertical={false}
          />

          <XAxis {...xAxisProps} />

          <YAxis
            stroke={THEME.textMuted}
            tick={{ fill: THEME.textMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: THEME.border }}
            allowDecimals={false}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="count"
            name="Eventos"
            stroke={THEME.accent}
            strokeWidth={2}
            fill="url(#timelineGradient)"
            dot={buckets.length <= 30}
            activeDot={{
              r: 5,
              fill: THEME.accent,
              stroke: THEME.surface,
              strokeWidth: 2,
            }}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TimelineChart;
