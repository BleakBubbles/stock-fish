import { css, ui } from './index';

/** Expose theme colours as CSS custom properties so stylesheets never hard-code them. */
export function applyThemeToDocument(el: HTMLElement): void {
  el.style.setProperty('--sf-water', css(ui.water));
  el.style.setProperty('--sf-highlight', css(ui.selectionOutline));
}
