import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Card, theme } from 'antd';

import { Sparkline } from '@/components/viz';
import { useChartColors, useTheme } from '@/hooks/useTheme';
import type { UsageLevel } from '@/models/status';
import { mean, peak } from './useOverviewHistory';

interface VitalTileProps {
  icon: ReactNode;
  label: string;
  percent: number;
  level: UsageLevel;
  detail: string;
  footLeft: string;
  footRight: string;
  data: number[];
  isMobile: boolean;
  // Pastel gives each vital its own accent; monochrome keeps the primary.
  tone?: number;
}

export default function VitalTile({
  icon,
  label,
  percent,
  level,
  detail,
  footLeft,
  footRight,
  data,
  isMobile,
  tone = 0,
}: VitalTileProps) {
  const { token } = theme.useToken();
  const { stylePreset } = useTheme();
  const tones = useChartColors().series;
  const okStroke = stylePreset === 'pastel' ? tones[tone % tones.length] : token.colorPrimary;
  const meanColor = token.colorTextTertiary;
  const stroke =
    level === 'crit' ? token.colorError : level === 'warn' ? token.colorWarning : okStroke;

  const referenceLines = useMemo(
    () => (data.length > 1 ? [{ y: mean(data), dash: '3 4', color: meanColor }] : []),
    [data, meanColor],
  );

  return (
    <Card className={`ov-tile ov-tile--${level}`} styles={{ body: { padding: 0 } }}>
      <div className="ov-tile-head">
        <span className="ov-tile-icon">{icon}</span>
        <span className="ov-kicker">{label}</span>
      </div>

      <div className="ov-tile-value">
        <span className="ov-tile-number">{percent.toFixed(1)}</span>
        <span className="ov-tile-unit">%</span>
      </div>

      <div className="ov-tile-detail">{detail}</div>

      <div className="ov-tile-foot">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>

      <div className="ov-tile-chart">
        <Sparkline
          data={data}
          height={isMobile ? 48 : 62}
          strokeWidth={1.5}
          fillOpacity={0.3}
          showGrid={false}
          showMarker={false}
          valueMax={peak(data) > 0 ? null : 100}
          stroke={stroke}
          referenceLines={referenceLines}
          yFormatter={(v) => `${v.toFixed(0)}%`}
          name1={label}
        />
      </div>
    </Card>
  );
}
