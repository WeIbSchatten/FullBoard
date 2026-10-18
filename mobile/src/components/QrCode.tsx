import { useMemo } from 'react';
import makeQr from 'qrcode-generator';
import Svg, { Path, Rect } from 'react-native-svg';

// Share links run long (Reality keys, xhttp extras), so let the library pick the version.
export function qrPath(text: string): { size: number; d: string } {
  const qr = makeQr(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size: n, d };
}

export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const { size: n, d } = useMemo(() => qrPath(value), [value]);
  const quiet = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`}>
      <Rect x={-quiet} y={-quiet} width={n + quiet * 2} height={n + quiet * 2} fill="#ffffff" />
      <Path d={d} fill="#000000" />
    </Svg>
  );
}
