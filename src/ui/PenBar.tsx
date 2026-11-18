import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { ARRANGE_MODES, type ArrangeMode, type Pen } from '../data/model';
import { PixelButton } from './pixel/PixelButton';

const ARRANGE_LABEL: Record<ArrangeMode, string> = {
  mood: 'Mood',
  species: 'Species',
  family: 'Family',
  weight: 'Weight',
  pen: 'Pen',
  free: 'Free roam',
};

interface Props {
  pens: readonly Pen[];
  /** Ids of the pens shown. */
  shown: readonly string[];
  arrange: ArrangeMode;
  /** True when several pens are shown (an overview). */
  overview: boolean;
  /** The pen tab a dragged fish is over. */
  dropTarget?: string;
  onShowAll: () => void;
  /** Show only this pen, or (with Ctrl, Cmd or Shift) add or remove it. */
  onPen: (penId: string, toggle: boolean) => void;
  onArrange: (mode: ArrangeMode) => void;
  onNewPen: () => void;
  onEditPen: () => void;
}

/** Which pens the tank shows, and how an overview is arranged. */
export function PenBar({
  pens,
  shown,
  arrange,
  overview,
  dropTarget,
  onShowAll,
  onPen,
  onArrange,
  onNewPen,
  onEditPen,
}: Props) {
  const all = shown.length === pens.length;
  const toggle = (e: MouseEvent) => e.ctrlKey || e.metaKey || e.shiftKey;

  return (
    <div className="pen-bar px-bar">
      <nav aria-label="Pens" className="px-row">
        {pens.length > 1 && (
          <PixelButton label="All" active={all} aria-pressed={all} onClick={onShowAll} />
        )}
        {pens.map((p) => {
          const on = shown.includes(p.id) && !(all && pens.length > 1);
          return (
            <PixelButton
              key={p.id}
              label={p.name}
              active={on}
              aria-pressed={on}
              data-pen-id={p.id}
              className={dropTarget === p.id ? 'is-drop' : undefined}
              title="Ctrl-click to show several pens"
              onClick={(e) => onPen(p.id, toggle(e))}
            />
          );
        })}
        <PixelButton label="+" aria-label="New pen" onClick={onNewPen} />
      </nav>
      {overview ? (
        <ArrangeMenu value={arrange} onChange={onArrange} />
      ) : (
        <PixelButton label="Edit pen" onClick={onEditPen} />
      )}
    </div>
  );
}

function ArrangeMenu({
  value,
  onChange,
}: {
  value: ArrangeMode;
  onChange: (mode: ArrangeMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="arrange">
      <PixelButton
        label={`Arrange: ${ARRANGE_LABEL[value]}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="arrange-menu px-panel px-stack" role="group" aria-label="Arrange by">
          {ARRANGE_MODES.map((m) => (
            <PixelButton
              key={m}
              label={ARRANGE_LABEL[m]}
              active={m === value}
              aria-pressed={m === value}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
