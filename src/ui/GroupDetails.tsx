import { ChangeHeadline } from './ChangeTicker';
import { PanelTitle } from './PanelTitle';
import { type Weather, type WeatherResult, togetherWords } from '../mood';
import { measureText, uiFont } from '../theme/pixelFont';
import { formatChangeRatio, formatMoney } from './format';
import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';
import { usePixelScale } from './pixel/context';

const WEATHER_LABEL: Record<Weather, string> = {
  sunny: 'Sunny',
  fair: 'Fair',
  calm: 'Calm',
  rainy: 'Rainy',
  stormy: 'Stormy',
};

/** UI pixels of padding, line and gaps around the panel's text (as FishDetails). */
const PANEL_CHROME = 2 * (4 + 1 + 3);
const LABEL_GAP = 4;
const LABELS = ['Today', 'Value', 'Share', 'Fish', 'Moves'];
const MAX_WIDTH = 200;

export interface GroupSummary {
  /** What the group is, e.g. "Pen", "Family", "Mood", "Species". */
  kind: string;
  name: string;
  fishCount: number;
  /** Weather of this group's priced fish; undefined if none are priced yet. */
  weather?: WeatherResult;
  /** Market value of its priced fish. */
  value?: number;
  /** Share of the value of all fish on screen (0–1). */
  share?: number;
  /** How many of its fish have no price yet. */
  unpriced: number;
  /** The home currency every amount here is in. */
  currency?: string;
  /** Correlation groups: the mean correlation between its members. */
  together?: number;
}

interface Props {
  summary: GroupSummary;
  /** Pen groups only: open the pen, or edit it. */
  onOpen?: () => void;
  onEdit?: () => void;
  onClose: () => void;
}

/** How a group of fish (a pen, family, mood or species) is doing: a mini weather bar. */
export function GroupDetails({ summary, onOpen, onEdit, onClose }: Props) {
  const scale = usePixelScale();
  const viewportUi = Math.floor((window.innerWidth * scale.dpr) / scale.ui);
  const textWidth = Math.min(MAX_WIDTH, viewportUi - PANEL_CHROME);
  const labelWidth = Math.max(...LABELS.map((l) => measureText(uiFont, l)));
  const valueWidth = textWidth - labelWidth - LABEL_GAP;
  const { weather, currency } = summary;

  const row = (label: string, value: string) => (
    <div className="px-dl-row">
      <span className="px-dt" style={{ width: `calc(var(--sf-px) * ${labelWidth})` }}>
        <PixelText text={label} tone="textMuted" />
      </span>
      <span className="px-dd">
        <PixelText text={value} wrap={valueWidth} />
      </span>
    </div>
  );

  return (
    <section className="fish-details px-panel px-stack" aria-label={`${summary.name} summary`}>
      <PanelTitle text={`${summary.kind}: ${summary.name}`} width={textWidth} onClose={onClose} />
      {weather && summary.value !== undefined && (
        <ChangeHeadline
          change={weather.changeRatio}
          percent={formatChangeRatio(weather.changeRatio)}
          money={formatMoney(weather.change, currency, true)}
          aside={<PixelText text={WEATHER_LABEL[weather.weather]} size={2} />}
        />
      )}
      <div className="px-dl" aria-live="polite">
        {weather && summary.value !== undefined ? (
          <>
            {row('Value', formatMoney(summary.value, currency))}
            {summary.share !== undefined && row('Share', `${(summary.share * 100).toFixed(1)}%`)}
          </>
        ) : (
          row('Today', 'Waiting for prices…')
        )}
        {row(
          'Sharks',
          summary.unpriced > 0
            ? `${summary.fishCount} (${summary.unpriced} without a price yet)`
            : String(summary.fishCount),
        )}
        {summary.together !== undefined &&
          row(
            'Moves',
            `${togetherWords(summary.together)} together (${summary.together.toFixed(2)})`,
          )}
      </div>
      {(onOpen || onEdit) && (
        <div className="px-row">
          {onOpen && <PixelButton label="Open pen" icon="forward" primary onClick={onOpen} />}
          {onEdit && <PixelButton label="Edit pen…" icon="edit" onClick={onEdit} />}
        </div>
      )}
    </section>
  );
}
