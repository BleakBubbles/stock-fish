import { css, ui } from './index';

/**
 * Expose theme colours as CSS custom properties (--sf-<name>), so stylesheets
 * never hard-code them. The pixel size (--sf-px) is set by PixelScaleProvider.
 */
export function applyThemeToDocument(el: HTMLElement): void {
  for (const [name, hex] of Object.entries(ui)) {
    el.style.setProperty(`--sf-${name}`, css(hex));
  }
}
