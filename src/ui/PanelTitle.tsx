import { PixelButton } from './pixel/PixelButton';
import { PixelText } from './pixel/PixelText';

/** UI pixels the close button takes beside the title: 17-pixel button and a 4-pixel gap. */
export const CLOSE_ROOM = 21;

/**
 * A details panel's title with its close button in the top-right corner, the
 * title's first line centred on the button.
 */
export function PanelTitle({
  text,
  width,
  onClose,
}: {
  text: string;
  /** The panel's text width in UI pixels; the title wraps short of the button. */
  width: number;
  onClose: () => void;
}) {
  return (
    <div className="panel-title">
      <span className="panel-title-text">
        <PixelText text={text} wrap={width - CLOSE_ROOM} />
      </span>
      <PixelButton label="Close" icon="close" iconOnly onClick={onClose} />
    </div>
  );
}
