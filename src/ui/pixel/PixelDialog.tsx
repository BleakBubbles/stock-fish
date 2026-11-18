import { type ReactNode, useEffect, useId, useRef } from 'react';
import { PixelText } from './PixelText';
import { useSnap } from './useSnap';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal panel inside the pixel root. Not a native <dialog>: the top layer
 * escapes the root's transform, which would put it off the pixel grid.
 * Escape or a click outside closes it; focus moves in on open and back after.
 */
export function PixelDialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useSnap(ref);
  // The latest onClose, so an inline callback doesn't re-run the focus effect.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('input, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !node) return;
      // Keep Tab inside the dialog.
      const items = [...node.querySelectorAll<HTMLElement>('input, button')];
      const firstItem = items[0];
      const lastItem = items.at(-1);
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem?.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="px-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="px-dialog px-panel px-stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span id={titleId}>
          <PixelText text={title} />
        </span>
        {children}
      </div>
    </div>
  );
}
