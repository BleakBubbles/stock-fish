import { useId } from 'react';
import type { Pen } from '../data/model';

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
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Pen</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {pens.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value={NEW_PEN}>New pen…</option>
      </select>
      {value === NEW_PEN && (
        <input
          aria-label="New pen name"
          placeholder="e.g. TFSA"
          value={newName}
          onChange={(e) => onNewNameChange(e.target.value)}
          maxLength={40}
          autoFocus
        />
      )}
    </div>
  );
}
