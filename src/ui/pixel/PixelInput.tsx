import {
  type InputHTMLAttributes,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { css, ui } from '../../theme';
import { caretIndexAt, caretOffsets, drawText, normalizeText, uiFont } from '../../theme/pixelFont';

interface Props extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'width' | 'size'
> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name. */
  label: string;
  /** Text area width in UI pixels. */
  width: number;
}

/** Blank font pixels kept right of the caret when the text scrolls. */
const CARET_ROOM = 2;
const BLINK_MS = 530;

/**
 * A text field drawn in the bitmap font. A real <input> sits on top, invisible,
 * so typing, IME, autofill, screen readers and mobile keyboards all work; we
 * only draw what it holds: text, selection and a 1-pixel caret.
 */
export function PixelInput({ value, onChange, label, width, className, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sel, setSel] = useState({ start: value.length, end: value.length });
  const [focused, setFocused] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const scrollRef = useRef(0);

  const offsets = useMemo(() => caretOffsets(uiFont, value), [value]);
  const text = useMemo(() => normalizeText(uiFont, value), [value]);

  // Follow the native selection (keys, IME, select-all, programmatic changes).
  useEffect(() => {
    const read = () => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? start;
      setSel((s) => (s.start === start && s.end === end ? s : { start, end }));
      setBlinkOn(true);
    };
    document.addEventListener('selectionchange', read);
    read();
    return () => document.removeEventListener('selectionchange', read);
  }, [value]);

  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => setBlinkOn((b) => !b), BLINK_MS);
    return () => clearInterval(timer);
  }, [focused, sel]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const caret = offsets[Math.min(sel.end, offsets.length - 1)] ?? 0;
    // Scroll so the caret stays in view.
    let scroll = scrollRef.current;
    if (caret - scroll > width - CARET_ROOM) scroll = caret - width + CARET_ROOM;
    if (caret < scroll) scroll = caret;
    scroll = Math.max(0, Math.min(scroll, Math.max(0, (offsets.at(-1) ?? 0) - width + CARET_ROOM)));
    scrollRef.current = scroll;

    ctx.clearRect(0, 0, width, uiFont.height);
    drawText(ctx, uiFont, text, -scroll, 0, css(ui.text));
    const a = offsets[Math.min(sel.start, sel.end)] ?? 0;
    const b = offsets[Math.max(sel.start, sel.end)] ?? 0;
    if (focused && b > a) {
      // Selected text: dark on the button colour.
      ctx.save();
      ctx.beginPath();
      ctx.rect(a - scroll, 0, b - a, uiFont.height);
      ctx.clip();
      ctx.fillStyle = css(ui.button);
      ctx.fillRect(a - scroll, 0, b - a, uiFont.height);
      drawText(ctx, uiFont, text, -scroll, 0, css(ui.buttonText));
      ctx.restore();
    } else if (focused && blinkOn) {
      ctx.fillStyle = css(ui.text);
      ctx.fillRect(Math.min(width - 1, caret - scroll), 1, 1, uiFont.baseline);
    }
  }, [text, offsets, sel, focused, blinkOn, width]);

  // Place the caret by the bitmap glyphs, not the hidden input's own font.
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    if (!input || !canvas || e.button !== 0) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width + scrollRef.current;
    const i = caretIndexAt(offsets, x);
    input.focus();
    input.setSelectionRange(i, i);
    setSel({ start: i, end: i });
  };

  return (
    <span
      className={['px-input', className].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={uiFont.height}
        aria-hidden
        style={{
          width: `calc(var(--sf-px) * ${width})`,
          height: `calc(var(--sf-px) * ${uiFont.height})`,
        }}
      />
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        spellCheck={false}
        autoComplete="off"
        {...rest}
      />
    </span>
  );
}
