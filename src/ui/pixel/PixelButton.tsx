import type { ButtonHTMLAttributes } from 'react';
import { type IconName, PixelIcon } from './PixelIcon';
import { PixelText } from './PixelText';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  primary?: boolean;
  /** Highlighted (e.g. the current tab). */
  active?: boolean;
  /** A pixel icon before the label. */
  icon?: IconName;
  /** Show only the icon: the label becomes the button's accessible name and tooltip. */
  iconOnly?: boolean;
}

/** A button with a pixel border, a hard shadow, and bitmap-font text and/or an icon. */
export function PixelButton({
  label,
  primary,
  active,
  icon,
  iconOnly,
  className,
  type = 'button',
  ...rest
}: Props) {
  const filled = primary || active;
  const tone = filled ? 'buttonText' : rest.disabled ? 'textMuted' : 'text';
  const onlyIcon = icon && iconOnly;
  return (
    <button
      type={type}
      className={['px-button', filled && 'is-filled', onlyIcon && 'is-icon', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={onlyIcon ? label : undefined}
      title={onlyIcon ? label : undefined}
      {...rest}
    >
      {onlyIcon ? (
        <PixelIcon name={icon} tone={tone} />
      ) : icon ? (
        <span className="px-button-content">
          <PixelIcon name={icon} tone={tone} />
          <PixelText text={label} tone={tone} />
        </span>
      ) : (
        <PixelText text={label} tone={tone} />
      )}
    </button>
  );
}
