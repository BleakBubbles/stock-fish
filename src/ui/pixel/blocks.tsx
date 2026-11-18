/**
 * Pixel UI building blocks for full screens (Holdings, Add, Edit, Settings):
 * headings, paragraphs that wrap to their column, links, choice groups and a
 * scroll area that settles on whole UI pixels.
 */
import {
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { PixelButton } from './PixelButton';
import { PixelText, type Tone } from './PixelText';
import { usePixelScale } from './context';
import { useWidth } from './useWidth';

/** A screen or section title, drawn at 2×. */
export function PixelHeading({
  text,
  level = 2,
  id,
}: {
  text: string;
  level?: 2 | 3;
  id?: string;
}) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag className="px-heading" id={id}>
      <PixelText text={text} size={2} tone="heading" />
    </Tag>
  );
}

/** Text that wraps to the width of its column. */
export function PixelParagraph({
  text,
  tone,
  role,
}: {
  text: string;
  tone?: Tone;
  role?: 'alert' | 'status';
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const width = useWidth(ref);
  return (
    <p ref={ref} className="px-para" role={role}>
      {width > 0 && <PixelText text={text} tone={tone} wrap={width} />}
    </p>
  );
}

/** A link: pixel text with a 1-pixel underline. Opens outside the app. */
export function PixelLink({ href, text }: { href: string; text: string }) {
  return (
    <a className="px-link" href={href} target="_blank" rel="noreferrer">
      <PixelText text={text} />
    </a>
  );
}

/** Pick one of a few options, as pixel buttons (a radio group for assistive tech). */
export function PixelChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="px-row" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <PixelButton
          key={o.value}
          label={o.label}
          role="radio"
          aria-checked={o.value === value}
          active={o.value === value}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

/** A label above a control. */
export function PixelField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-field">
      <PixelText text={hint ? `${label} (${hint})` : label} tone="textMuted" />
      {children}
    </div>
  );
}

/** Thinnest scrollbar thumb, in UI pixels. */
const MIN_THUMB = 8;

/**
 * A scrolling area inside the pixel root. While moving it can sit between UI
 * pixels (motion hides it); when scrolling stops it settles on a whole one.
 * The browser's scrollbar would be scaled up with the root (chunky and off
 * the grid), so it's hidden and a thin pixel one is drawn instead; it can be
 * dragged, and wheel, keyboard and touch scrolling work as usual.
 */
export function PixelScroll({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { ui, dpr } = usePixelScale();
  const [thumb, setThumb] = useState<{ top: number; height: number }>();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      const top = Math.round(node.scrollTop);
      if (top !== node.scrollTop) node.scrollTop = top;
    };
    const measure = () => {
      const track = trackRef.current?.clientHeight ?? 0;
      const { scrollHeight: full, clientHeight: view, scrollTop } = node;
      if (full <= view + 1 || track === 0) return setThumb(undefined);
      const height = Math.max(MIN_THUMB, Math.round((track * view) / full));
      const top = Math.round(((track - height) * scrollTop) / (full - view));
      setThumb((t) => (t?.top === top && t.height === height ? t : { top, height }));
    };
    // scrollend where supported; a short pause otherwise.
    const onScroll = () => {
      measure();
      clearTimeout(timer);
      timer = setTimeout(settle, 150);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('scrollend', settle);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('scrollend', settle);
    };
  }, []);

  // Drag the thumb: pointer movement in UI pixels, scaled to the content.
  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    const track = trackRef.current;
    if (!node || !track || !thumb || e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startScroll = node.scrollTop;
    const ratio =
      (node.scrollHeight - node.clientHeight) / Math.max(1, track.clientHeight - thumb.height);
    const onMove = (ev: PointerEvent) => {
      const dy = (ev.clientY - startY) / (ui / dpr);
      node.scrollTop = startScroll + dy * ratio;
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      node.scrollTop = Math.round(node.scrollTop);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="px-scroll-wrap">
      <div ref={ref} className={['px-scroll', className].filter(Boolean).join(' ')}>
        {children}
      </div>
      <div ref={trackRef} className="px-scrollbar" aria-hidden>
        {thumb && (
          <div
            className="px-scrollbar-thumb"
            style={{
              top: `calc(var(--sf-px) * ${thumb.top})`,
              height: `calc(var(--sf-px) * ${thumb.height})`,
            }}
            onPointerDown={onThumbDown}
          />
        )}
      </div>
    </div>
  );
}

/** Props for a button that opens a hidden file input. */
export type FileButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  label: string;
  accept: string;
  onFile: (file: File) => void;
};

/** A pixel button that picks a file. */
export function PixelFileButton({ label, accept, onFile, ...rest }: FileButtonProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <PixelButton label={label} onClick={() => ref.current?.click()} {...rest} />
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
