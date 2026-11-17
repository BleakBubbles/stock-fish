import { useState } from 'react';
import { colours, css, type FishColours, type Hex } from '../theme';

interface Props {
  value: FishColours;
  onChange: (next: FishColours) => void;
}

type Slot = 'primary' | 'secondary';

const SLOT_LABEL: Record<Slot, string> = { primary: 'Body', secondary: 'Fins' };

/**
 * Pick body and fin colours from the 32-colour palette. Any colour is allowed
 * in either slot, with no warnings.
 */
export function ColourPicker({ value, onChange }: Props) {
  const [slot, setSlot] = useState<Slot>('primary');

  const choose = (hex: Hex) => onChange({ ...value, [slot]: hex });

  return (
    <div className="colour-picker">
      <div className="slot-tabs" role="radiogroup" aria-label="Colour to change">
        {(['primary', 'secondary'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={slot === s}
            className={`slot-tab${slot === s ? ' is-active' : ''}`}
            onClick={() => setSlot(s)}
          >
            <span className="swatch-chip" style={{ background: css(value[s]) }} aria-hidden />
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="swatches" role="radiogroup" aria-label={`${SLOT_LABEL[slot]} colour`}>
        {colours.map((hex, i) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={value[slot] === hex}
            aria-label={`Colour ${i + 1} of ${colours.length}, #${hex}`}
            className={`swatch${value[slot] === hex ? ' is-selected' : ''}`}
            style={{ background: css(hex) }}
            onClick={() => choose(hex)}
          />
        ))}
      </div>
    </div>
  );
}
