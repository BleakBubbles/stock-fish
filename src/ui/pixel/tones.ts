import { ui } from '../../theme';

/** Text colours for bitmap text and icons. */
export type Tone =
  | 'text'
  | 'textMuted'
  | 'buttonText'
  | 'warning'
  | 'success'
  | 'heading'
  | 'changeGreen'
  | 'changeRed'
  | 'heart'
  | 'heartGold';

export const TONE_COLOUR: Record<Tone, string> = {
  text: ui.text,
  textMuted: ui.textMuted,
  buttonText: ui.buttonText,
  warning: ui.warning,
  success: ui.success,
  heading: ui.heading,
  changeGreen: ui.changeGreen,
  changeRed: ui.changeRed,
  heart: ui.heart,
  heartGold: ui.heartGold,
};
