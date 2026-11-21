import { Fragment, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  GROUP_MODES,
  type GroupMode,
  type Pen,
  SORT_MODES,
  type SortMode,
  type TankLabels,
} from '../data/model';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { PixelButton } from './pixel/PixelButton';
import type { IconName } from './pixel/PixelIcon';
import { usePixelScale } from './pixel/context';
import { PixelIcon } from './pixel/PixelIcon';
import { PixelText } from './pixel/PixelText';
import type { WeatherResult } from '../mood';
import { direction, directionTone } from './change';
import { formatChangeRatio } from './format';
import { useSettings } from '../data/store';

const GROUP_LABEL: Record<GroupMode, string> = {
  mood: 'Mood',
  pen: 'Pen',
  family: 'Family',
  species: 'Species',
  correlation: 'Correlation',
  none: 'None',
  free: 'Free roam',
};

const SORT_LABEL: Record<SortMode, string> = {
  weight: 'Weight',
  change: "Today's change",
  mood: 'Mood',
  name: 'Name',
  custom: 'Custom',
};

/** Shorter names on the bar's buttons. */
const SORT_SHORT: Record<SortMode, string> = { ...SORT_LABEL, change: 'Change' };

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
/** Narrower than this beside the right-hand buttons, the pens menu wraps onto its own row. */
const MENU_MIN = 60;

const textWidth = (s: string) => measureText(uiFont, normalizeText(uiFont, s));
const buttonWidth = (s: string, icon = false) =>
  textWidth(s) + BUTTON_CHROME + (icon ? ICON_WIDTH : 0);
/** A Group or Sort button's width: its longest label, with its icon. */
const choiceWidth = <T extends string>(
  title: string,
  modes: readonly T[],
  labels: Record<T, string>,
) => Math.max(...modes.map((m) => buttonWidth(`${title}: ${labels[m]}`, true)));

interface Props {
  pens: readonly Pen[];
  /** Ids of the pens shown. */
  shown: readonly string[];
  /** How an overview groups the fish. */
  group: GroupMode;
  /** The patch order in force (an overview's, or the single pen's). */
  sort: SortMode;
  /** True when several pens are shown (an overview). */
  overview: boolean;
  /** The pen tab a dragged fish is over. */
  dropTarget?: string;
  onShowAll: () => void;
  /** Untick "All pens": back to the pens shown before it was chosen. */
  onUnshowAll: () => void;
  /** Show only this pen, or add or remove it from what's shown. */
  onPen: (penId: string, toggle: boolean) => void;
  onGroup: (mode: GroupMode) => void;
  onSort: (mode: SortMode) => void;
  /** Labels drawn with the fish (the View menu). */
  labels: TankLabels;
  onLabels: (labels: TankLabels) => void;
  onNewPen: () => void;
  onEditPen: () => void;
  /** Each pen's weather today, when any of its fish is priced. */
  penWeather?: ReadonlyMap<string, WeatherResult>;
  /** The weather of all pens together. */
  allWeather?: WeatherResult;
}

/**
 * Which pens the tank shows, and how an overview is arranged. Pens are tabs
 * when they fit on one row (a fish can be dropped on a tab); otherwise, as on
 * phones, a menu where each pen can be shown alone or ticked to show several.
 */
export function PenBar(props: Props) {
  const { pens, shown, group, sort, overview, dropTarget, onShowAll, onPen } = props;
  const { cols } = usePixelScale();
  const all = shown.length === pens.length;

  const right = (
    <div className="px-row">
      <ViewMenu value={props.labels} onChange={props.onLabels} />
      {overview && (
        <ChoiceMenu
          title="Group"
          icon="group"
          className="arrange"
          modes={GROUP_MODES}
          labels={GROUP_LABEL}
          breakBefore="none"
          value={group}
          onChange={props.onGroup}
        />
      )}
      {/* Free roam has no patches, so no order: Sort stays in place, greyed out. */}
      <ChoiceMenu
        title="Sort"
        disabled={overview && group === 'free'}
        icon="sort"
        className="arrange"
        modes={SORT_MODES}
        labels={SORT_LABEL}
        short={SORT_SHORT}
        breakBefore="custom"
        value={sort}
        onChange={props.onSort}
      />
      {!overview && <PixelButton label="Edit pen" icon="edit" onClick={props.onEditPen} />}
    </div>
  );
  // Group and Sort keep the width of their longest label, so the bar doesn't shift.
  const rightWidths = [
    buttonWidth('View', true),
    ...(overview ? [choiceWidth('Group', GROUP_MODES, GROUP_LABEL)] : []),
    choiceWidth('Sort', SORT_MODES, SORT_SHORT),
    ...(overview ? [] : [buttonWidth('Edit pen', true)]),
  ];
  const rightWidth = rightWidths.reduce((a, w) => a + w, 0) + TAB_GAP * (rightWidths.length - 1);
  // The pen tabs (each with its weather icon once priced), then the icon-only "new pen" button.
  const { penWeather, allWeather } = props;
  const tabs = [
    ...(pens.length > 1 ? [{ label: 'All', weather: allWeather }] : []),
    ...pens.map((p) => ({ label: p.name, weather: penWeather?.get(p.id) })),
  ];
  const tabsWidth =
    tabs.reduce((a, t) => a + buttonWidth(t.label, t.weather !== undefined), 0) +
    ICON_BUTTON +
    TAB_GAP * tabs.length;
  // The root can be one column wider than the window; leave it out.
  const room = cols - 1 - 2 * BAR_PADDING - SIDE_GAP - rightWidth;

  if (tabsWidth > room) {
    return (
      <div className="pen-bar px-bar">
        <PensMenu
          {...props}
          // Beside the right-hand buttons when there's room, else alone on its row (phones).
          maxLabel={
            (room >= MENU_MIN ? room : cols - 1 - 2 * BAR_PADDING) - BUTTON_CHROME - ICON_WIDTH
          }
        />
        {right}
      </div>
    );
  }

  const toggle = (e: MouseEvent) => e.ctrlKey || e.metaKey || e.shiftKey;
  return (
    <div className="pen-bar px-bar">
      <nav aria-label="Pens" className="px-row">
        {pens.length > 1 && (
          <PixelButton
            label="All"
            icon={allWeather?.weather}
            active={all}
            aria-pressed={all}
            aria-label={withWeather('All pens', allWeather)}
            onClick={onShowAll}
          />
        )}
        {pens.map((p) => {
          const on = shown.includes(p.id) && !(all && pens.length > 1);
          return (
            <PixelButton
              key={p.id}
              label={p.name}
              icon={penWeather?.get(p.id)?.weather}
              aria-label={withWeather(p.name, penWeather?.get(p.id))}
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

/** A pen's name for screen readers, with its weather when known. */
function withWeather(name: string, w: WeatherResult | undefined): string {
  return w ? `${name}, ${w.weather}, ${formatChangeRatio(w.changeRatio)} today` : name;
}

/**
 * A pen's weather in the pens menu: its icon and today's %, right-aligned in
 * a column `width` UI pixels wide so the pens' numbers line up like a board.
 */
function WeatherFigure({ weather, width }: { weather?: WeatherResult; width: number }) {
  const settings = useSettings();
  if (!weather) return <span className="pen-weather" />;
  const tone = directionTone(direction(weather.changeRatio), settings?.upColour);
  return (
    <span className="pen-weather" aria-hidden="true">
      <PixelIcon name={weather.weather} />
      <span className="pen-weather-figure" style={{ width: `calc(var(--sf-px) * ${width})` }}>
        <PixelText text={formatChangeRatio(weather.changeRatio)} tone={tone} />
      </span>
    </span>
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
  onUnshowAll,
  onPen,
  onNewPen,
  maxLabel,
  penWeather,
  allWeather,
}: Props & { maxLabel: number }) {
  const all = shown.length === pens.length;
  // One column for every pen's %, as wide as the widest.
  const figures = [allWeather, ...pens.map((p) => penWeather?.get(p.id))].flatMap((w) =>
    w ? [formatChangeRatio(w.changeRatio)] : [],
  );
  const figureWidth = Math.max(0, ...figures.map(textWidth));
  const only = shown.length === 1 ? pens.find((p) => p.id === shown[0]) : undefined;
  const summary = all && pens.length > 1 ? 'All pens' : only ? only.name : `${shown.length} pens`;

  return (
    <Popover
      label={fit(summary, maxLabel)}
      icon="all"
      buttonLabel={`Pens: ${summary}`}
      className="pens-menu"
      menuLabel="Pens"
    >
      {(close) => (
        <>
          {pens.length > 1 && (
            <div className="px-input-row">
              {/*
                Ticked when every pen is shown. Ticking shows them all; unticking
                goes back to the pens shown before (or the first pen alone).
              */}
              <button
                type="button"
                role="checkbox"
                aria-checked={all}
                aria-label="Show all pens"
                className={all ? 'px-check is-on' : 'px-check'}
                onClick={() => (all ? onUnshowAll() : onShowAll())}
              />
              <PixelButton
                label="All pens"
                active={all}
                aria-pressed={all}
                aria-label={withWeather('All pens', allWeather)}
                onClick={() => {
                  onShowAll();
                  close();
                }}
              />
              <WeatherFigure weather={allWeather} width={figureWidth} />
            </div>
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
                  aria-label={`Show only ${withWeather(p.name, penWeather?.get(p.id))}`}
                  onClick={() => {
                    onPen(p.id, false);
                    close();
                  }}
                />
                <WeatherFigure weather={penWeather?.get(p.id)} width={figureWidth} />
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
  width,
  disabled,
  children,
}: {
  label: string;
  icon?: IconName;
  /** The button's width in UI pixels, when it shouldn't follow its label. */
  width?: number;
  disabled?: boolean;
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
        disabled={disabled}
        style={width ? { width: `calc(var(--sf-px) * ${width})` } : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && !disabled && (
        <div className="popover-menu px-panel px-stack" role="group" aria-label={menuLabel}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/**
 * A bar button that opens a list of modes to pick one from (Group, Sort): a
 * heading, then one full-width row per mode with a marker on the current one,
 * and a divider before `breakBefore` (the modes that don't group or sort by a
 * measure).
 */
function ChoiceMenu<T extends string>({
  title,
  icon,
  className,
  modes,
  labels,
  short = labels,
  breakBefore,
  disabled,
  value,
  onChange,
}: {
  title: string;
  icon: IconName;
  className: string;
  modes: readonly T[];
  labels: Record<T, string>;
  /** Names for the bar's button, when shorter than the menu's. */
  short?: Record<T, string>;
  /** A divider goes above this mode. */
  breakBefore?: T;
  /** Shown but not usable (Sort in free roam). */
  disabled?: boolean;
  value: T;
  onChange: (mode: T) => void;
}) {
  return (
    <Popover
      label={`${title}: ${short[value]}`}
      buttonLabel={`${title} by: ${labels[value]}`}
      icon={icon}
      className={className}
      menuLabel={`${title} by`}
      width={choiceWidth(title, modes, short)}
      disabled={disabled}
    >
      {(close) => (
        <>
          <span className="choice-heading">
            <PixelText text={`${title} by`} tone="textMuted" />
          </span>
          {modes.map((m) => (
            <Fragment key={m}>
              {m === breakBefore && <span className="choice-divider" aria-hidden />}
              <button
                type="button"
                className={m === value ? 'choice-row is-on' : 'choice-row'}
                aria-pressed={m === value}
                onClick={() => {
                  onChange(m);
                  close();
                }}
              >
                <span className="choice-mark" aria-hidden />
                <PixelText text={labels[m]} />
              </button>
            </Fragment>
          ))}
        </>
      )}
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
