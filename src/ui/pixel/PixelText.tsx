import { useLayoutEffect, useMemo, useRef } from 'react';
import { css, ui } from '../../theme';
import { TONE_COLOUR, type Tone } from './tones';
import { drawText, measureText, normalizeText, uiFont, wrapText } from '../../theme/pixelFont';

/** Blank font pixels between wrapped lines. */
export const LINE_GAP = 2;

interface Props {
  text: string;
  tone?: Tone;
  /** Wrap to this many UI pixels wide (at spaces). Omit for a single line. */
  wrap?: number;
  /** UI pixels per font pixel: 1, or 2 for headings. Always a whole number. */
  size?: 1 | 2;
  /**
   * A one-pixel dark outline around every letter (as on fish labels), for text
   * over the tank without a box. Adds a pixel on every side.
   */
  outline?: boolean;
}

/**
 * Text drawn from the bitmap font at a whole number of UI pixels per font
 * pixel (inside PixelRoot, so it's crisp at any devicePixelRatio). The real
 * text stays in the DOM (visually hidden) for screen readers, find-in-page and
 * translation.
 */
export function PixelText({ text, tone = 'text', wrap, size = 1, outline = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => {
    const normal = normalizeText(uiFont, text);
    const lines = wrap ? wrapText(uiFont, normal, Math.floor(wrap / size)) : [normal];
    const pad = outline ? 1 : 0;
    const width = Math.max(1, ...lines.map((l) => measureText(uiFont, l))) + 2 * pad;
    const height = lines.length * uiFont.height + (lines.length - 1) * LINE_GAP + 2 * pad;
    return { lines, width, height, pad };
  }, [text, wrap, size, outline]);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    const { pad } = layout;
    const draw = (dx: number, dy: number, colour: string) =>
      layout.lines.forEach((line, i) => {
        drawText(ctx, uiFont, line, pad + dx, pad + dy + i * (uiFont.height + LINE_GAP), colour);
      });
    if (pad) {
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) draw(dx, dy, css(ui.night));
    }
    draw(0, 0, css(TONE_COLOUR[tone]));
  }, [layout, tone]);

  return (
    <span className="px-text">
      <canvas
        ref={ref}
        width={layout.width}
        height={layout.height}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${layout.width * size})`,
          height: `calc(var(--sf-px) * ${layout.height * size})`,
        }}
      />
      <span className="sr-only">{text}</span>
    </span>
  );
}
