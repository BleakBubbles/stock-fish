import { togetherWords } from '../mood';
import { MIN_RETURNS } from '../mood/volatility';
import type { Mood } from '../mood/types';
import type { FishView } from '../tank/model';
import { measureText, uiFont } from '../theme/pixelFont';
import { normalizeCurrency } from '../data/currency';
import { formatChangeRatio, formatDay, formatMoney } from './format';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
import { RangeBar } from './RangeBar';
import { ChangeHeadline } from './ChangeTicker';
import { MoodFace } from './MoodFace';
import { PanelTitle } from './PanelTitle';
import { usePixelScale } from './pixel/context';

const MOOD_LABEL: Record<Mood, string> = {
  ecstatic: 'Ecstatic',
  happy: 'Happy',
  neutral: 'Calm',
  uneasy: 'Uneasy',
  sad: 'Sad',
};

/** UI pixels of padding, border and gaps around the panel's text (see .fish-details). */
const PANEL_CHROME = 2 * (4 + 1 + 3);
const LABEL_GAP = 4;
const LABELS = ['Price', 'Holding', 'Mood', 'Moves'];
/** Never wider than this many UI pixels, even on big screens. */
const MAX_WIDTH = 200;
/** The typical-day range bar is at most this wide. */
const BAR_MAX = 101;

interface Props {
  fish: FishView;
  /** The pen it lives in, shown in an overview of several pens. */
  penName?: string;
  /** Totals' currency: the holding's value is also shown in it when the stock trades in another. */
  homeCurrency?: string;
  /** The shown holding it moves most with, market move taken out (src/mood/correlation.ts). */
  closest?: { symbol: string; correlation: number };
  onChangeColours: () => void;
  onMove: () => void;
  onClose: () => void;
}

/** The numbers behind one fish: what a price board would show. */
export function FishDetails({
  fish,
  penName,
  homeCurrency,
  closest,
  onChangeColours,
  onMove,
  onClose,
}: Props) {
  const scale = usePixelScale();
  const quote = fish.quote;
  const result = fish.moodResult;
  const currency = quote?.currency;

  // Text widths in UI pixels, so long values wrap instead of overflowing.
  const viewportUi = Math.floor((window.innerWidth * scale.dpr) / scale.ui);
  const textWidth = Math.min(MAX_WIDTH, viewportUi - PANEL_CHROME);
  const labelWidth = Math.max(...LABELS.map((l) => measureText(uiFont, l)));
  const valueWidth = textWidth - labelWidth - LABEL_GAP;

  // In the home currency too, when the stock trades in another one.
  const foreign = homeCurrency && currency && normalizeCurrency(currency).code !== homeCurrency;
  const converted =
    foreign && fish.home ? ` (≈ ${formatMoney(fish.home.value, homeCurrency)})` : '';

  const row = (label: string, value: string, muted?: string) => (
    <div className="px-dl-row">
      <span className="px-dt" style={{ width: `calc(var(--sf-px) * ${labelWidth})` }}>
        <PixelText text={label} tone="textMuted" />
      </span>
      <span className="px-dd">
        <PixelText text={muted ? `${value} ${muted}` : value} wrap={valueWidth} />
      </span>
    </div>
  );

  // A day-old price (a fund before tonight's price): its move is that day's, not today's.
  const staleDay = fish.stale ? formatDay(fish.stale) : undefined;
  const moodNote = staleDay
    ? '(no price yet today)'
    : result?.reason === 'short-history'
      ? `(new: needs ${MIN_RETURNS} days of prices first)`
      : undefined;
  // Today against a typical day, as a bar with the numbers under it.
  const range =
    !staleDay && result?.reason === 'ok' && result.sigma !== undefined && result.z !== undefined
      ? { z: result.z, sigma: result.sigma }
      : undefined;

  return (
    <section className="fish-details px-panel px-stack" aria-label={`${fish.symbol} details`}>
      <PanelTitle
        text={fish.name ? `${fish.symbol} · ${fish.name}` : fish.symbol}
        width={textWidth}
        onClose={onClose}
      />
      {penName && <PixelText text={`In ${penName}`} tone="textMuted" wrap={textWidth} />}
      {quote && result ? (
        <div className="px-stack" aria-live="polite">
          <ChangeHeadline
            change={result.todayReturn}
            percent={formatChangeRatio(result.todayReturn)}
            money={formatMoney(fish.change ?? NaN, currency, true)}
            aside={range && <MoodFace mood={fish.mood} size={2} />}
            {...(staleDay && { when: `on ${staleDay}` })}
          />
          <div className="px-dl">
            {row('Price', formatMoney(quote.price, currency))}
            {row(
              'Holding',
              `${fish.quantity.toLocaleString()} × ${formatMoney(quote.price, currency)} = ${formatMoney(fish.quantity * quote.price, currency)}${converted}`,
            )}
            {row('Mood', MOOD_LABEL[fish.mood], moodNote)}
            {range && (
              <div className="px-dl-row">
                <span className="px-dt" style={{ width: `calc(var(--sf-px) * ${labelWidth})` }} />
                <span className="px-dd range-cell">
                  <RangeBar z={range.z} width={Math.min(BAR_MAX, valueWidth)} />
                  <PixelText
                    text={`Typical day ±${(range.sigma * 100).toFixed(2)}%`}
                    tone="textMuted"
                    wrap={valueWidth}
                  />
                </span>
              </div>
            )}
            {closest &&
              closest.symbol !== fish.symbol &&
              row(
                'Moves',
                `${togetherWords(closest.correlation)} with ${closest.symbol} (${closest.correlation.toFixed(2)})`,
              )}
          </div>
        </div>
      ) : (
        <PixelText
          text={
            fish.state === 'error' ? `Couldn't get prices: ${fish.error}` : 'Waiting for prices…'
          }
          tone={fish.state === 'error' ? 'warning' : 'textMuted'}
          wrap={textWidth}
        />
      )}
      {quote && fish.error && (
        <PixelText text={`Last update failed: ${fish.error}`} tone="warning" wrap={textWidth} />
      )}
      <div className="px-row">
        <PixelButton label="Change colours" icon="colours" onClick={onChangeColours} />
        <PixelButton label="Move…" icon="forward" onClick={onMove} />
      </div>
    </section>
  );
}
