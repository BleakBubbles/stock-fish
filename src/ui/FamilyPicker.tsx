import type { FishColours } from '../theme';
import { FAMILIES, bodyForSector } from '../theme/bodies';
import { FishSprite } from './FishSprite';

interface Props {
  /** Currently shown sector, or undefined when unknown. */
  sector: string | undefined;
  colours: FishColours;
  onChange: (sector: string) => void;
}

/** Pick which of the six families (bodies) a fish belongs to, shown as the fish itself. */
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
          className={`family${current === f.body ? ' is-selected' : ''}`}
          onClick={() => onChange(f.sector)}
        >
          <FishSprite
            body={f.body}
            mood="neutral"
            primary={colours.primary}
            secondary={colours.secondary}
            scale={1}
          />
          <span>{f.label}</span>
        </button>
      ))}
    </div>
  );
}
