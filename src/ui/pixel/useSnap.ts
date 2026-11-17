import { type RefObject, useLayoutEffect } from 'react';
import { usePixelScale } from './context';

/**
 * Nudge an element inside PixelRoot (centred, or placed by percentages) so its
 * top-left corner sits on a whole UI pixel. Its insides then stay on the grid,
 * since all pixel UI sizes are whole UI pixels.
 */
export function useSnap(ref: RefObject<HTMLElement | null>): void {
  const { dpr, ui } = usePixelScale();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // The root sits at the viewport's origin, so viewport CSS px ÷ this = root UI px.
    const unit = ui / dpr;
    const snap = () => {
      node.style.translate = '';
      const r = node.getBoundingClientRect();
      const x = r.left / unit;
      const y = r.top / unit;
      const dx = Math.round(x) - x;
      const dy = Math.round(y) - y;
      node.style.translate = dx || dy ? `${dx}px ${dy}px` : '';
    };
    snap();
    const observer = new ResizeObserver(snap);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => observer.disconnect();
  }, [ref, dpr, ui]);
}
