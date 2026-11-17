import type { ButtonHTMLAttributes } from 'react';
import { PixelText } from './PixelText';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  primary?: boolean;
  /** Highlighted (e.g. the current tab). */
  active?: boolean;
}

/** A button with a pixel border, a hard shadow and bitmap-font text. */
export function PixelButton({
  label,
  primary,
  active,
  className,
  type = 'button',
  ...rest
}: Props) {
  const filled = primary || active;
  return (
    <button
      type={type}
      className={['px-button', filled && 'is-filled', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <PixelText text={label} tone={filled ? 'buttonText' : 'text'} />
    </button>
  );
}
