import { type KeyboardEvent, useId, useRef, useState } from 'react';
import type { FishView } from '../tank/model';
import { describeFish } from './describeFish';

interface Props {
  /** The fish on screen, in the order they're arranged. */
  fish: readonly FishView[];
  penName: (penId: string) => string | undefined;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  /**
   * In a single pen: move a fish's patch one place earlier (−1) or later (+1).
   * Returns its new place (1-based) and the count, to announce.
   */
  onReorder?: (id: string, step: -1 | 1) => Promise<{ place: number; of: number } | undefined>;
}

/**
 * The tank for keyboards and screen readers: one tab stop that holds every
 * fish on screen. Arrow keys move between fish and select each one (it lights
 * up in the tank and its details open); Alt + arrows reorder patches in a
 * single pen; Escape clears. Visually hidden: the tank's highlight shows focus.
 */
export function FishList({ fish, penName, selectedId, onSelect, onReorder }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const hintId = useId();
  const [announce, setAnnounce] = useState('');
  const index = Math.max(
    0,
    fish.findIndex((f) => f.id === selectedId),
  );

  const focusAt = (i: number) => {
    const target = fish[Math.max(0, Math.min(fish.length - 1, i))];
    if (!target) return;
    onSelect(target.id);
    // After React re-renders the roving tab stop.
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-fish="${target.id}"]`)?.focus(),
    );
  };

  const onKeyDown = async (e: KeyboardEvent<HTMLUListElement>) => {
    const current = fish[index];
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key.startsWith('Arrow') ? -1 : 0;
    if (step && e.altKey && onReorder && current) {
      e.preventDefault();
      const moved = await onReorder(current.id, step);
      if (moved) setAnnounce(`${current.symbol} moved to place ${moved.place} of ${moved.of}.`);
      return;
    }
    if (step) {
      e.preventDefault();
      focusAt(index + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(fish.length - 1);
    } else if (e.key === 'Escape') {
      onSelect(undefined);
    }
  };

  if (fish.length === 0) return null;
  return (
    <div className="sr-only">
      <p id={hintId}>
        Arrow keys choose a fish and show its details.
        {onReorder ? ' Alt and arrow keys move its patch earlier or later.' : ''}
      </p>
      <ul
        ref={listRef}
        aria-label="Fish"
        aria-describedby={hintId}
        onKeyDown={(e) => void onKeyDown(e)}
      >
        {fish.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              data-fish={f.id}
              tabIndex={i === index ? 0 : -1}
              aria-pressed={f.id === selectedId}
              onFocus={() => f.id !== selectedId && onSelect(f.id)}
              onClick={() => onSelect(f.id)}
            >
              {describeFish(f, penName(f.penId))}
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{announce}</p>
    </div>
  );
}
