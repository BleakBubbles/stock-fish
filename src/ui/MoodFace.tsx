import { useLayoutEffect, useRef } from 'react';
import type { Mood } from '../mood/types';
import { decorFrames, decorUrl } from '../theme/decor';

/** The badge faces are 9 × 9, the height of a text line. */
const SIZE = 9;

let sheet: Promise<HTMLImageElement> | undefined;
function loadSheet(): Promise<HTMLImageElement> {
  sheet ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = decorUrl;
  });
  return sheet;
}

/**
 * The mood badge's face (art/badges), as drawn above fish in the tank, on a
 * text line. Decorative: the mood word beside it says the same.
 */
export function MoodFace({ mood, size = 1 }: { mood: Mood; size?: 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    let live = true;
    const frame = decorFrames[`badge-${mood}`];
    if (!frame) return;
    loadSheet()
      .then((img) => {
        const ctx = ref.current?.getContext('2d');
        if (!live || !ctx) return;
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [mood]);
  return (
    <span className="px-text">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${SIZE * size})`,
          height: `calc(var(--sf-px) * ${SIZE * size})`,
        }}
      />
    </span>
  );
}
