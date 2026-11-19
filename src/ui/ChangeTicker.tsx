import type { ReactNode } from 'react';
import { useSettings } from '../data/store';
import { direction, directionIcon, directionTone } from './change';
import { PixelIcon } from './pixel/PixelIcon';
import { PixelText } from './pixel/PixelText';

/**
 * Today's change as a price board shows it: on a dark strip, with an arrow
 * for its direction and green or red (the user's choice of which means up)
 * repeating it. The sign and the arrow carry the direction on their own.
 */
export function ChangeTicker({
  change,
  text,
  size = 1,
}: {
  change: number;
  text: string;
  size?: 1 | 2;
}) {
  const tone = useChangeTone(change);
  const icon = directionIcon(direction(change));
  return (
    <span className={size === 2 ? 'change-ticker is-big' : 'change-ticker'}>
      {icon && <PixelIcon name={icon} tone={tone} size={size} />}
      <PixelText text={text} tone={tone} size={size} />
    </span>
  );
}

function useChangeTone(change: number) {
  const settings = useSettings();
  return directionTone(direction(change), settings?.upColour);
}

/**
 * The top of a details panel: today's % change large on its strip, with
 * `aside` (the mood face, or the weather) beside it, and the money change
 * under it in the same colour.
 */
export function ChangeHeadline({
  change,
  percent,
  money,
  aside,
}: {
  change: number;
  percent: string;
  money: string;
  aside?: ReactNode;
}) {
  const tone = useChangeTone(change);
  return (
    <div className="change-headline">
      <div className="change-headline-top">
        <ChangeTicker change={change} text={percent} size={2} />
        {aside}
      </div>
      <PixelText text={`${money} today`} tone={tone} />
    </div>
  );
}
