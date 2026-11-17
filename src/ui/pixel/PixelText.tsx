import { useLayoutEffect, useMemo, useRef } from 'react';
import { css, ui } from '../../theme';
import { drawText, measureText, normalizeText, uiFont, wrapText } from '../../theme/pixelFont';

export type Tone = 'text' | 'textMuted' | 'buttonText' | 'warning' | 'success';

/** Blank font pixels between wrapped lines. */
export const LINE_GAP = 2;

interface Props {
  text: string;
  tone?: Tone;
  /** Wrap to this many UI pixels wide (at spaces). Omit for a single line. */
  wrap?: number;
}

/**
 * Text drawn from the bitmap font at exactly one UI pixel per font pixel
 * (inside PixelRoot, so it's crisp at any devicePixelRatio). The real text stays in the DOM
 * (visually hidden) for screen readers, find-in-page and translation.
 */
export function PixelText({ text, tone = 'text', wrap }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => {
    const normal = normalizeText(uiFont, text);
    const lines = wrap ? wrapText(uiFont, normal, wrap) : [normal];
    const width = Math.max(1, ...lines.map((l) => measureText(uiFont, l)));
    const height = lines.length * uiFont.height + (lines.length - 1) * LINE_GAP;
    return { lines, width, height };
  }, [text, wrap]);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    layout.lines.forEach((line, i) => {
      drawText(ctx, uiFont, line, 0, i * (uiFont.height + LINE_GAP), css(ui[tone]));
    });
  }, [layout, tone]);

  return (
    <span className="px-text">
      <canvas
        ref={ref}
        width={layout.width}
        height={layout.height}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${layout.width})`,
          height: `calc(var(--sf-px) * ${layout.height})`,
        }}
      />
      <span className="sr-only">{text}</span>
    </span>
  );
}
