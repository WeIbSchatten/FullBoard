import { useCallback, useState } from 'react';

// Content-box width of the element the returned ref lands on; 0 until it is measured.
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
