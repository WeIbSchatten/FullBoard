import Svg, { G, Polyline, Rect } from 'react-native-svg';

import { usePalette } from '@/theme';

const W_POINTS = '8.6,10 12.3,22 16,13.4 19.7,22 23.4,10';

// Same "white shadow" W as the panel's BrandMark.tsx.
export function BrandMark({ size = 32 }: { size?: number }) {
  const p = usePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={9} fill={p.accent} />
      <G fill="none" stroke={p.onAccent} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points={W_POINTS} transform="translate(1.7 1.7)" strokeOpacity={0.35} />
        <Polyline points={W_POINTS} />
      </G>
    </Svg>
  );
}
