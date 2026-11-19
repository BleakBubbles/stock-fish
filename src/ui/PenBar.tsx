import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ARRANGE_MODES, type ArrangeMode, type Pen, type TankLabels } from '../data/model';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { PixelButton } from './pixel/PixelButton';
import type { IconName } from './pixel/PixelIcon';
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
/** An icon before a button's label: 7 pixels and a 4-pixel gap (see .px-button-content). */
const ICON_WIDTH = 11;
/** An icon-only button: the 7-pixel icon and the chrome. */
const ICON_BUTTON = 7 + BUTTON_CHROME;
/** Gaps between tabs, and the bar's padding (see .px-row and .pen-bar). */
const TAB_GAP = 3;
const BAR_PADDING = 3;
const SIDE_GAP = 4;

const textWidth = (s: string) => measureText(uiFont, normalizeText(uiFont, s));
const buttonWidth = (s: string, icon = false) =>
  textWidth(s) + BUTTON_CHROME + (icon ? ICON_WIDTH : 0);

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
  /** Labels drawn with the fish (the View menu). */
  labels: TankLabels;
  onLabels: (labels: TankLabels) => void;
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

  const right = (
    <div className="px-row">
      <ViewMenu value={props.labels} onChange={props.onLabels} />
      {overview ? (
        <ArrangeMenu value={arrange} onChange={onArrange} />
      ) : (
        <PixelButton label="Edit pen" icon="edit" onClick={props.onEditPen} />
      )}
    </div>
  );
  const rightWidth =
    ICON_BUTTON +
    TAB_GAP +
    buttonWidth(overview ? `Arrange: ${ARRANGE_LABEL[arrange]}` : 'Edit pen', true);
  // The pen tabs, then the icon-only "new pen" button.
  const tabLabels = [...(pens.length > 1 ? ['All'] : []), ...pens.map((p) => p.name)];
  const tabsWidth =
    tabLabels.reduce((a, l) => a + buttonWidth(l), 0) + ICON_BUTTON + TAB_GAP * tabLabels.length;
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
        <PixelButton label="New pen" icon="plus" iconOnly onClick={props.onNewPen} />
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
            icon="plus"
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
  icon,
  iconOnly,
  className,
  menuLabel,
  children,
}: {
  label: string;
  icon?: IconName;
  /** Show only the icon (the label becomes its name and tooltip). */
  iconOnly?: boolean;
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
        icon={icon}
        iconOnly={iconOnly}
        aria-label={buttonLabel ?? (iconOnly ? label : undefined)}
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
    <Popover
      label={`Arrange: ${ARRANGE_LABEL[value]}`}
      icon="arrange"
      className="arrange"
      menuLabel="Arrange by"
    >
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

const VIEW_OPTIONS: { key: keyof TankLabels; label: string }[] = [
  { key: 'ticker', label: 'Tickers' },
  { key: 'change', label: "Today's change" },
  { key: 'mood', label: 'Mood faces' },
];

/** What's drawn with the fish: tickers, today's change, mood faces. Ticks, so the menu stays open. */
function ViewMenu({
  value,
  onChange,
}: {
  value: TankLabels;
  onChange: (labels: TankLabels) => void;
}) {
  return (
    <Popover label="View" icon="show" className="view" menuLabel="Labels">
      {() =>
        VIEW_OPTIONS.map(({ key, label }) => {
          const on = value[key];
          const flip = () => onChange({ ...value, [key]: !on });
          return (
            <div key={key} className="px-input-row">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={label}
                className={on ? 'px-check is-on' : 'px-check'}
                onClick={flip}
              />
              <PixelButton label={label} tabIndex={-1} aria-hidden onClick={flip} />
            </div>
          );
        })
      }
    </Popover>
  );
}
