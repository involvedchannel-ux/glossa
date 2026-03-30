/** Classic Latin lorem ipsum pools for premade blocks (static, no generator). */

const PARAS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
  "Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis.",
];

const SHORT = PARAS[0] ?? "";
const TITLE = "Lorem ipsum dolor sit amet";
const SUBTITLE = "Consectetur adipiscing elit sed do eiusmod tempor";

export function loremShortParagraph(): string {
  return SHORT;
}

export function loremTwoParagraphs(): string {
  return `${PARAS[0] ?? ""}\n\n${PARAS[1] ?? ""}`;
}

export function loremTitleSubtitle(): string {
  return `${TITLE}\n${SUBTITLE}`;
}

export function loremTitleSubtitleBody(): string {
  return `${TITLE}\n${SUBTITLE}\n\n${PARAS[2] ?? PARAS[0] ?? ""}`;
}

export function loremBullets(count: number): string {
  const lines = PARAS.slice(0, Math.max(1, count)).map((p) => {
    const snippet = p.split(". ")[0]?.trim() ?? p;
    return `• ${snippet}.`;
  });
  while (lines.length < count) {
    lines.push(`• ${TITLE.toLowerCase()}, ${SUBTITLE.toLowerCase()}.`);
  }
  return lines.slice(0, count).join("\n");
}

export function loremNumbered(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const src = PARAS[i % PARAS.length] ?? SHORT;
    const snippet = src.split(". ")[0]?.trim() ?? src;
    lines.push(`${i + 1}. ${snippet}.`);
  }
  return lines.join("\n");
}

export function loremDialog(exchanges: number): string {
  const parts: string[] = [];
  for (let i = 0; i < exchanges; i++) {
    const snippet =
      (PARAS[i % PARAS.length] ?? SHORT).split(". ")[0]?.trim() ?? SHORT;
    parts.push(i % 2 === 0 ? `A: ${snippet}?` : `B: ${snippet}.`);
  }
  return parts.join("\n");
}
