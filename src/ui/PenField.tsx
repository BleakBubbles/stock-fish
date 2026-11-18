import { MAX_PEN_NAME, type Pen } from '../data/model';
import { PixelInput } from './pixel/PixelInput';
import { PixelChoice, PixelField } from './pixel/blocks';

export const NEW_PEN = '__new__';

interface Props {
  pens: Pen[];
  /** A pen id, or NEW_PEN. */
  value: string;
  newName: string;
  onChange: (value: string) => void;
  onNewNameChange: (name: string) => void;
}

/** Choose an existing pen or name a new one. */
export function PenField({ pens, value, newName, onChange, onNewNameChange }: Props) {
  return (
    <PixelField label="Pen">
      <PixelChoice
        label="Pen"
        options={[
          ...pens.map((p) => ({ value: p.id, label: p.name })),
          { value: NEW_PEN, label: 'New pen…' },
        ]}
        value={value}
        onChange={onChange}
      />
      {value === NEW_PEN && (
        <PixelInput
          label="New pen name"
          placeholder="e.g. TFSA"
          value={newName}
          onChange={onNewNameChange}
          maxLength={MAX_PEN_NAME}
          autoFocus
        />
      )}
    </PixelField>
  );
}
