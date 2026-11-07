import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Incident, RiskLevel } from '../../../types';
import { RISK_COLORS, THEME } from '../../../constants/rules';
import { calcRiskDistribution } from '../../../lib/stats';
import Card from '../../ui/Card';

export interface RiskDistributionChartProps {
  incidents: Incident[];
}

interface TooltipPayloadEntry {
  name: RiskLevel;
  value: number;
  payload: { riskLevel: RiskLevel; count: number; percentage: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const { riskLevel, count, percentage } = payload[0].payload;
  const colors = RISK_COLORS[riskLevel];
  const meanings: Record<RiskLevel, string> = {
    'CRÍTICO': 'Acción inmediata (< 1 hora)',
    'ALTO': 'Revisión prioritaria (< 4 horas)',
    'MEDIO': 'Revisar en 24 horas',
    'BAJO': 'Monitorear y documentar',
    'INFORMATIVO': 'Sin acción requerida',
  };
  return (
    <div style={{
      backgroundColor: THEME.surface,
      border: `1px solid ${THEME.border}`,
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.8125rem',
      color: THEME.textPrimary,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: '190px',
    }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: '0.25rem',
        padding: '0.125rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginBottom: '0.5rem',
      }}>{riskLevel}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <span style={{ color: THEME.textMuted }}>Incidentes</span>
        <span style={{ fontWeight: 700 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <span style={{ color: THEME.textMuted }}>Porcentaje</span>
        <span style={{ fontWeight: 700 }}>{percentage.toFixed(1)} %</span>
      </div>
      <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: THEME.textMuted, fontStyle: 'italic' }}>
        {meanings[riskLevel]}
      </div>
    </div>
  );
};

const RADIAN = Math.PI / 180;
interface LabelProps {
  cx: number; cy: number; midAngle: number;
  innerRadius: number; outerRadius: number;
  riskLevel: RiskLevel; percentage: number; count: number;
}

const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, riskLevel, percentage, count }: LabelProps) => {
  if (percentage < 4) return null;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const col = RISK_COLORS[riskLevel].bg;
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      fill={col} fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
      <tspan x={x} dy="-0.6em" fontWeight={800}>{riskLevel}</tspan>
      <tspan x={x} dy="1.2em" fontSize={10}>{count} ({percentage.toFixed(1)}%)</tspan>
    </text>
  );
};

const EmptyState: React.FC = () => (
  <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: THEME.textMuted, fontSize: '0.9375rem' }}>
    No se detectaron incidentes
  </div>
);

const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({ incidents }) => {
  const data = calcRiskDistribution(incidents);
  return (
    <Card title="Distribución por Criticidad (Casos y %)">
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data} dataKey="count" nameKey="riskLevel"
              cx="45%" cy="50%" outerRadius={100}
              labelLine={true}
              label={(props) => renderCustomLabel({
                cx: props.cx, cy: props.cy, midAngle: props.midAngle,
                innerRadius: props.innerRadius, outerRadius: props.outerRadius,
                riskLevel: props.riskLevel as RiskLevel,
                percentage: props.percentage, count: props.count,
              })}
              isAnimationActive={true}
            >
              {data.map((entry) => (
                <Cell key={entry.riskLevel}
                  fill={RISK_COLORS[entry.riskLevel].bg}
                  stroke={THEME.surface} strokeWidth={2}
                  aria-label={`${entry.riskLevel}: ${entry.count}`} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical" align="right" verticalAlign="middle"
              formatter={(value) => (
                <span style={{ color: THEME.textPrimary, fontSize: '0.8125rem', fontWeight: 600 }}>
                  {value as string}: {data.find(d => d.riskLevel === value)?.count ?? 0}
                </span>
              )}
              iconType="square"
              wrapperStyle={{ paddingLeft: '1rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

export default RiskDistributionChart;