import {
  loremBullets,
  loremDialog,
  loremNumbered,
  loremShortParagraph,
  loremTitleSubtitle,
  loremTitleSubtitleBody,
  loremTwoParagraphs,
} from "./lorem";
import type { LanguageId } from "./language";
import type { CorpusRuntimeModel } from "./corpusModel";
import { createRng, type PRNG } from "./markov";
import {
  generateParagraphHu,
  generateHuPremadeSentence,
  huLexiconForSeed,
} from "./hu/synthesize";
import { HU_TUNING } from "./hu/tuning";
import {
  DEFAULT_QUALITY_MIX,
  normalizeQualityMix,
  type QualityMix,
} from "./qualityMix";
import { RO_TUNING } from "./ro/tuning";
import {
  generateParagraphRo,
  generateRoPremadeSentence,
  roLexiconForSeed,
} from "./ro/synthesize";

export type CorpusBundle = {
  hu: CorpusRuntimeModel | null;
  ro: CorpusRuntimeModel | null;
};

export type LengthPreset = "short" | "medium" | "long";

const LENGTH_SENTENCES: Record<LengthPreset, { min: number; max: number }> = {
  short: { min: 3, max: 4 },
  medium: { min: 5, max: 7 },
  long: { min: 8, max: 12 },
};

function sentenceCount(rng: PRNG, preset: LengthPreset): number {
  const { min, max } = LENGTH_SENTENCES[preset];
  return min + Math.floor((max - min + 1) * rng());
}

function roParagraph(
  seed: number,
  sentenceCount: number,
  roModel: CorpusRuntimeModel | null,
  quality: QualityMix,
): string {
  const rng = createRng(seed);
  const lex = roLexiconForSeed(seed, RO_TUNING, roModel, quality);
  return generateParagraphRo(
    rng,
    lex,
    sentenceCount,
    RO_TUNING,
    roModel,
    quality,
  );
}

function roSentence(
  seed: number,
  wordCount: number,
  roModel: CorpusRuntimeModel | null,
  quality: QualityMix,
): string {
  return generateRoPremadeSentence(seed, wordCount, RO_TUNING, roModel, quality);
}

function huParagraph(
  seed: number,
  sentenceCount: number,
  huModel: CorpusRuntimeModel | null,
  quality: QualityMix,
): string {
  const rng = createRng(seed);
  const lex = huLexiconForSeed(seed, HU_TUNING, huModel, quality);
  return generateParagraphHu(
    rng,
    lex,
    sentenceCount,
    HU_TUNING,
    huModel,
    quality,
  );
}

function huSentence(
  seed: number,
  wordCount: number,
  huModel: CorpusRuntimeModel | null,
  quality: QualityMix,
): string {
  return generateHuPremadeSentence(seed, wordCount, HU_TUNING, huModel, quality);
}

export function generatePremadeBlock(
  lang: LanguageId,
  blockId: string,
  seed: number,
  corpus: CorpusBundle,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const q = normalizeQualityMix(quality);
  if (lang === "ro") {
    const roM = corpus.ro;
    const rngRo = createRng(seed);
    switch (blockId) {
      case "para-short": {
        const n = sentenceCount(rngRo, "short");
        return roParagraph(seed, n, roM, q);
      }
      case "para-double": {
        const n1 = sentenceCount(rngRo, "medium");
        const n2 = sentenceCount(createRng(seed ^ 0x9e3779b9), "medium");
        return `${roParagraph(seed, n1, roM, q)}\n\n${roParagraph(seed ^ 0x9e3779b9, n2, roM, q)}`;
      }
      case "title-subtitle":
        return `${roSentence(seed, 4, roM, q)}\n${roSentence(seed + 1, 5, roM, q)}`;
      case "title-subtitle-body":
        return `${roSentence(seed, 3, roM, q)}\n${roSentence(seed + 2, 4, roM, q)}\n\n${roParagraph(seed + 3, sentenceCount(rngRo, "medium"), roM, q)}`;
      case "bullets": {
        const lines: string[] = [];
        for (let i = 0; i < 4; i++) {
          lines.push(`• ${roSentence(seed + i * 31, 7, roM, q)}`);
        }
        return lines.join("\n");
      }
      case "numbered": {
        const lines: string[] = [];
        for (let i = 0; i < 5; i++) {
          lines.push(`${i + 1}. ${roSentence(seed + i * 17, 7, roM, q)}`);
        }
        return lines.join("\n");
      }
      case "dialog": {
        const parts: string[] = [];
        for (let i = 0; i < 4; i++) {
          const line = roSentence(seed + i * 13, 6, roM, q);
          parts.push(i % 2 === 0 ? `A: ${line}` : `B: ${line}`);
        }
        return parts.join("\n");
      }
      default:
        return roParagraph(seed, sentenceCount(rngRo, "short"), roM, q);
    }
  }

  if (lang === "hu") {
    const huM = corpus.hu;
    const rngHu = createRng(seed);
    switch (blockId) {
      case "para-short": {
        const n = sentenceCount(rngHu, "short");
        return huParagraph(seed, n, huM, q);
      }
      case "para-double": {
        const n1 = sentenceCount(rngHu, "medium");
        const n2 = sentenceCount(createRng(seed ^ 0x9e3779b9), "medium");
        return `${huParagraph(seed, n1, huM, q)}\n\n${huParagraph(seed ^ 0x9e3779b9, n2, huM, q)}`;
      }
      case "title-subtitle":
        return `${huSentence(seed, 4, huM, q)}\n${huSentence(seed + 1, 5, huM, q)}`;
      case "title-subtitle-body":
        return `${huSentence(seed, 3, huM, q)}\n${huSentence(seed + 2, 4, huM, q)}\n\n${huParagraph(seed + 3, sentenceCount(rngHu, "medium"), huM, q)}`;
      case "bullets": {
        const lines: string[] = [];
        for (let i = 0; i < 4; i++) {
          lines.push(`• ${huSentence(seed + i * 31, 7, huM, q)}`);
        }
        return lines.join("\n");
      }
      case "numbered": {
        const lines: string[] = [];
        for (let i = 0; i < 5; i++) {
          lines.push(`${i + 1}. ${huSentence(seed + i * 17, 7, huM, q)}`);
        }
        return lines.join("\n");
      }
      case "dialog": {
        const parts: string[] = [];
        for (let i = 0; i < 4; i++) {
          const line = huSentence(seed + i * 13, 6, huM, q);
          parts.push(i % 2 === 0 ? `A: ${line}` : `B: ${line}`);
        }
        return parts.join("\n");
      }
      default:
        return huParagraph(seed, sentenceCount(rngHu, "short"), huM, q);
    }
  }

  if (lang === "la") {
    switch (blockId) {
      case "para-short":
        return loremShortParagraph();
      case "para-double":
        return loremTwoParagraphs();
      case "title-subtitle":
        return loremTitleSubtitle();
      case "title-subtitle-body":
        return loremTitleSubtitleBody();
      case "bullets":
        return loremBullets(4);
      case "numbered":
        return loremNumbered(5);
      case "dialog":
        return loremDialog(4);
      default:
        return loremShortParagraph();
    }
  }

  return loremShortParagraph();
}

export type CustomStructure = "paragraph" | "bullets" | "numbered" | "dialog" | "mixed";

export function generateCustom(args: {
  lang: LanguageId;
  structure: CustomStructure;
  quantity: number;
  length: LengthPreset;
  seed: number;
  corpus: CorpusBundle;
  quality?: QualityMix | null;
}): string {
  const { lang, structure, quantity, length, seed, corpus } = args;
  const qu = normalizeQualityMix(args.quality);

  if (lang === "la") {
    return generateLatinCustom(structure, quantity, length);
  }

  if (lang === "hu") {
    const huM = corpus.hu;
    const rngHu = createRng(seed);
    const q = Math.max(1, Math.min(structure === "dialog" ? 20 : 12, quantity));
    switch (structure) {
      case "paragraph": {
        const paras: string[] = [];
        for (let p = 0; p < q; p++) {
          const n = sentenceCount(createRng(seed + p * 997), length);
          paras.push(huParagraph(seed + p * 997, n, huM, qu));
        }
        return paras.join("\n\n");
      }
      case "bullets": {
        const lines: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 6 : length === "medium" ? 8 : 11;
          lines.push(`• ${huSentence(seed + i * 41, wc, huM, qu)}`);
        }
        return lines.join("\n");
      }
      case "numbered": {
        const lines: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 6 : length === "medium" ? 8 : 11;
          lines.push(`${i + 1}. ${huSentence(seed + i * 43, wc, huM, qu)}`);
        }
        return lines.join("\n");
      }
      case "dialog": {
        const parts: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 5 : length === "medium" ? 8 : 11;
          const line = huSentence(seed + i * 47, wc, huM, qu);
          parts.push(i % 2 === 0 ? `A: ${line}` : `B: ${line}`);
        }
        return parts.join("\n");
      }
      case "mixed": {
        const intro = huParagraph(
          seed,
          sentenceCount(rngHu, length === "short" ? "short" : "medium"),
          huM,
          qu,
        );
        const lines: string[] = [];
        for (let i = 0; i < 3; i++) {
          lines.push(`• ${huSentence(seed + 100 + i, 7, huM, qu)}`);
        }
        return `${intro}\n\n${lines.join("\n")}`;
      }
      default:
        return huParagraph(seed, sentenceCount(rngHu, length), huM, qu);
    }
  }

  if (lang === "ro") {
    const roM = corpus.ro;
    const rngRo = createRng(seed);
    const q = Math.max(1, Math.min(structure === "dialog" ? 20 : 12, quantity));
    switch (structure) {
      case "paragraph": {
        const paras: string[] = [];
        for (let p = 0; p < q; p++) {
          const n = sentenceCount(createRng(seed + p * 997), length);
          paras.push(roParagraph(seed + p * 997, n, roM, qu));
        }
        return paras.join("\n\n");
      }
      case "bullets": {
        const lines: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 6 : length === "medium" ? 8 : 11;
          lines.push(`• ${roSentence(seed + i * 41, wc, roM, qu)}`);
        }
        return lines.join("\n");
      }
      case "numbered": {
        const lines: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 6 : length === "medium" ? 8 : 11;
          lines.push(`${i + 1}. ${roSentence(seed + i * 43, wc, roM, qu)}`);
        }
        return lines.join("\n");
      }
      case "dialog": {
        const parts: string[] = [];
        for (let i = 0; i < q; i++) {
          const wc = length === "short" ? 5 : length === "medium" ? 8 : 11;
          const line = roSentence(seed + i * 47, wc, roM, qu);
          parts.push(i % 2 === 0 ? `A: ${line}` : `B: ${line}`);
        }
        return parts.join("\n");
      }
      case "mixed": {
        const intro = roParagraph(
          seed,
          sentenceCount(rngRo, length === "short" ? "short" : "medium"),
          roM,
          qu,
        );
        const lines: string[] = [];
        for (let i = 0; i < 3; i++) {
          lines.push(`• ${roSentence(seed + 100 + i, 7, roM, qu)}`);
        }
        return `${intro}\n\n${lines.join("\n")}`;
      }
      default:
        return roParagraph(seed, sentenceCount(rngRo, length), roM, qu);
    }
  }

  return loremShortParagraph();
}

function generateLatinCustom(
  structure: CustomStructure,
  quantity: number,
  length: LengthPreset,
): string {
  const q = Math.max(1, Math.min(12, quantity));
  switch (structure) {
    case "paragraph": {
      const paras: string[] = [];
      for (let i = 0; i < q; i++) {
        paras.push(
          loremShortParagraph() +
            (length === "long" ? " " + loremShortParagraph() : ""),
        );
      }
      return paras.join("\n\n");
    }
    case "bullets":
      return loremBullets(q);
    case "numbered":
      return loremNumbered(q);
    case "dialog":
      return loremDialog(q);
    case "mixed":
      return `${loremShortParagraph()}\n\n${loremBullets(3)}`;
    default:
      return loremShortParagraph();
  }
}
