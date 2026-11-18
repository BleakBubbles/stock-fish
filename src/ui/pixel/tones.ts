import { ui } from '../../theme';

/** Text colours for bitmap text and icons. */
export type Tone = 'text' | 'textMuted' | 'buttonText' | 'warning' | 'success' | 'heading';

export const TONE_COLOUR: Record<Tone, string> = {
  text: ui.text,
  textMuted: ui.textMuted,
  buttonText: ui.buttonText,
  warning: ui.warning,
  success: ui.success,
  heading: ui.heading,
};
