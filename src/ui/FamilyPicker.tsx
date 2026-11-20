import type { FishColours } from '../theme';
import { FAMILIES, bodyForSector } from '../theme/bodies';
import { SPRITE_WIDTH } from '../theme/sprites';
import { measureText, normalizeText, uiFont } from '../theme/pixelFont';
import { FishSprite } from './FishSprite';
import { PixelText } from './pixel/PixelText';

interface Props {
  /** Currently shown sector, or undefined when unknown. */
  sector: string | undefined;
  colours: FishColours;
  onChange: (sector: string) => void;
}

/** Short names that fit under a fish in the pixel font. */
const SHORT: Record<number, string> = {
  1: 'Tech',
  2: 'Finance',
  3: 'Consumer',
  4: 'Energy',
  5: 'Industrial',
  6: 'Health',
  7: 'Fund',
  8: 'Crypto',
};

/** Card width in UI pixels: room for the longest name ("Industrial") plus a margin. */
const CARD = 58;

/**
 * Left offset that centres something `width` pixels wide in a card, rounded
 * down to a whole pixel (CSS centring would put odd leftovers on half pixels).
 */
const centre = (width: number) => `calc(var(--sf-px) * ${Math.floor((CARD - width) / 2)})`;

/** Pick which family (body) a fish belongs to, shown as the fish itself. */
export function FamilyPicker({ sector, colours, onChange }: Props) {
  const current = sector ? bodyForSector(sector) : undefined;
  return (
    <div className="families" role="radiogroup" aria-label="Family">
      {FAMILIES.map((f) => (
        <button
          key={f.body}
          type="button"
          role="radio"
          aria-checked={current === f.body}
          aria-label={f.label}
          className={`family${current === f.body ? ' is-selected' : ''}`}
          style={{ width: `calc(var(--sf-px) * ${CARD})` }}
          onClick={() => onChange(f.sector)}
        >
          <span style={{ marginLeft: centre(SPRITE_WIDTH) }}>
            <FishSprite
              body={f.body}
              mood="neutral"
              primary={colours.primary}
              secondary={colours.secondary}
              scale={1}
            />
          </span>
          <span
            style={{
              marginLeft: centre(
                measureText(uiFont, normalizeText(uiFont, SHORT[f.body] ?? f.label)),
              ),
            }}
          >
            <PixelText
              text={SHORT[f.body] ?? f.label}
              tone={current === f.body ? 'buttonText' : 'text'}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
