export type TextCounts = {
  characters: number;
  words: number;
  lines: number;
};

export function countText(text: string): TextCounts {
  const trimmed = text.trimEnd();
  const characters = [...trimmed].length;
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
  const lines = trimmed.length === 0 ? 0 : trimmed.split("\n").length;
  return { characters, words, lines };
}
