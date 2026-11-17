import { integerScale } from '../tank/constants';
import { css, ui } from './index';

/**
 * Expose theme colours and the art-pixel size as CSS custom properties, so
 * stylesheets never hard-code them. --sf-px is the size of one art pixel in
 * CSS pixels: the same whole-number scale the tank uses.
 */
export function applyThemeToDocument(el: HTMLElement): () => void {
  for (const [name, hex] of Object.entries(ui)) {
    el.style.setProperty(`--sf-${name}`, css(hex));
  }
  const setScale = () => {
    const scale = integerScale(window.innerWidth, window.innerHeight);
    el.style.setProperty('--sf-px', `${scale}px`);
  };
  setScale();
  window.addEventListener('resize', setScale);
  return () => window.removeEventListener('resize', setScale);
}
