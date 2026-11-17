/** Offer text to the user as a downloaded file. */
export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Parse a number typed by a person: blank is undefined, commas as thousands separators. */
export function parseNumberInput(text: string): number | undefined {
  const cleaned = text.trim().replace(/,/g, '');
  if (cleaned === '') return undefined;
  return Number(cleaned);
}
