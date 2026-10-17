// uPlot sizes its canvases from devicePixelRatio once, at module load, and the
// panel's interface-size zoom would upscale them blurry; render at up to 150%.
const SUPERSAMPLE = 1.5;

function nativeDescriptor(): PropertyDescriptor | undefined {
  for (let o: object | null = window; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, 'devicePixelRatio');
    if (d) return d;
  }
  return undefined;
}

const native = nativeDescriptor();
const readNative = (): number =>
  (native?.get ? (native.get.call(window) as number) : native?.value) || 1;

if (!(window as { __fbDprShim?: boolean }).__fbDprShim) {
  (window as { __fbDprShim?: boolean }).__fbDprShim = true;
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get: () => readNative() * SUPERSAMPLE,
  });
}

export {};
