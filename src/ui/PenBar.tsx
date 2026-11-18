import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ARRANGE_MODES, type ArrangeMode, type Pen } from '../data/model';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { PixelButton } from './pixel/PixelButton';
import { usePixelScale } from './pixel/context';

const ARRANGE_LABEL: Record<ArrangeMode, string> = {
  mood: 'Mood',
  species: 'Species',
  family: 'Family',
  weight: 'Weight',
  pen: 'Pen',
  free: 'Free roam',
};

/** UI pixels a PixelButton adds around its text: padding 3 + line 1 each side. */
const BUTTON_CHROME = 8;
/** Gaps between tabs, and the bar's padding (see .px-row and .pen-bar). */
const TAB_GAP = 3;
const BAR_PADDING = 3;
const SIDE_GAP = 4;

const textWidth = (s: string) => measureText(uiFont, normalizeText(uiFont, s));
const buttonWidth = (s: string) => textWidth(s) + BUTTON_CHROME;

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
  /** Show only this pen, or add or remove it from what's shown. */
  onPen: (penId: string, toggle: boolean) => void;
  onArrange: (mode: ArrangeMode) => void;
  onNewPen: () => void;
  onEditPen: () => void;
}

/**
 * Which pens the tank shows, and how an overview is arranged. Pens are tabs
 * when they fit on one row (a fish can be dropped on a tab); otherwise, as on
 * phones, a menu where each pen can be shown alone or ticked to show several.
 */
export function PenBar(props: Props) {
  const { pens, shown, arrange, overview, dropTarget, onShowAll, onPen, onArrange } = props;
  const { cols } = usePixelScale();
  const all = shown.length === pens.length;

  const right = overview ? (
    <ArrangeMenu value={arrange} onChange={onArrange} />
  ) : (
    <PixelButton label="Edit pen" onClick={props.onEditPen} />
  );
  const rightWidth = buttonWidth(overview ? `Arrange: ${ARRANGE_LABEL[arrange]}` : 'Edit pen');
  const tabLabels = [...(pens.length > 1 ? ['All'] : []), ...pens.map((p) => p.name), '+'];
  const tabsWidth =
    tabLabels.reduce((a, l) => a + buttonWidth(l), 0) + TAB_GAP * (tabLabels.length - 1);
  // The root can be one column wider than the window; leave it out.
  const room = cols - 1 - 2 * BAR_PADDING - SIDE_GAP - rightWidth;

  if (tabsWidth > room) {
    return (
      <div className="pen-bar px-bar">
        <PensMenu {...props} maxLabel={room - BUTTON_CHROME} />
        {right}
      </div>
    );
  }

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
        <PixelButton label="+" aria-label="New pen" onClick={props.onNewPen} />
      </nav>
      {right}
    </div>
  );
}

/** The label cut short with "…" to fit `width` UI pixels. */
function fit(label: string, width: number): string {
  if (textWidth(label) <= width) return label;
  for (let n = label.length - 1; n > 0; n--) {
    const cut = `${label.slice(0, n).trimEnd()}…`;
    if (textWidth(cut) <= width) return cut;
  }
  return '…';
}

function PensMenu({
  pens,
  shown,
  onShowAll,
  onPen,
  onNewPen,
  maxLabel,
}: Props & { maxLabel: number }) {
  const all = shown.length === pens.length;
  const only = shown.length === 1 ? pens.find((p) => p.id === shown[0]) : undefined;
  const summary = all && pens.length > 1 ? 'All pens' : only ? only.name : `${shown.length} pens`;

  return (
    <Popover
      label={fit(summary, maxLabel)}
      buttonLabel={`Pens: ${summary}`}
      className="pens-menu"
      menuLabel="Pens"
    >
      {(close) => (
        <>
          {pens.length > 1 && (
            <PixelButton
              label="All pens"
              active={all}
              aria-pressed={all}
              onClick={() => {
                onShowAll();
                close();
              }}
            />
          )}
          {pens.map((p) => {
            const on = shown.includes(p.id);
            return (
              <div key={p.id} className="px-input-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Show ${p.name} with the others`}
                  className={on ? 'px-check is-on' : 'px-check'}
                  onClick={() => onPen(p.id, true)}
                />
                <PixelButton
                  label={p.name}
                  active={on && !all && shown.length === 1}
                  aria-label={`Show only ${p.name}`}
                  onClick={() => {
                    onPen(p.id, false);
                    close();
                  }}
                />
              </div>
            );
          })}
          <PixelButton
            label="New pen…"
            onClick={() => {
              onNewPen();
              close();
            }}
          />
        </>
      )}
    </Popover>
  );
}

/** A button that opens a pixel panel below it; a click outside or Escape closes it. */
function Popover({
  label,
  buttonLabel,
  className,
  menuLabel,
  children,
}: {
  label: string;
  /** Accessible name, when the visible label is shortened. */
  buttonLabel?: string;
  className: string;
  menuLabel: string;
  children: (close: () => void) => ReactNode;
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
    <div ref={ref} className={`popover ${className}`}>
      <PixelButton
        label={label}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="popover-menu px-panel px-stack" role="group" aria-label={menuLabel}>
          {children(() => setOpen(false))}
        </div>
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
  return (
    <Popover label={`Arrange: ${ARRANGE_LABEL[value]}`} className="arrange" menuLabel="Arrange by">
      {(close) =>
        ARRANGE_MODES.map((m) => (
          <PixelButton
            key={m}
            label={ARRANGE_LABEL[m]}
            active={m === value}
            aria-pressed={m === value}
            onClick={() => {
              onChange(m);
              close();
            }}
          />
        ))
      }
    </Popover>
  );
}
