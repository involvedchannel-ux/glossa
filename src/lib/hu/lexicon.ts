import {
  genWordFromCorpus,
  validateHuContentWord,
  type CorpusRuntimeModel,
} from "../corpusModel";
import { createRng, type PRNG } from "../markov";
import {
  DEFAULT_QUALITY_MIX,
  type QualityMix,
} from "../qualityMix";
import type { HuTuning } from "./tuning";
import { fakeAdjectiveHu, fakeNounLemma, fakeStem } from "./fakeWord";

export type HuLexicon = {
  nouns: readonly string[];
  verbStems: readonly string[];
  adjectives: readonly string[];
};

function maxGraphemesForBuild(
  m: CorpusRuntimeModel | null,
  t: HuTuning,
): number {
  const base = m?.language === "hu" ? m.maxWordGraphemes : 14;
  return Math.max(
    5,
    Math.min(18, Math.floor(base * t.shape.spellingCapScale)),
  );
}

function uniqueFill(
  rng: PRNG,
  gen: (r: PRNG) => string,
  target: number,
  m: CorpusRuntimeModel | null,
  maxG: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let guard = 0;
  const limit = target * 240;
  while (out.length < target && guard++ < limit) {
    const w = gen(rng);
    if (w.length < 3 || seen.has(w)) continue;
    if (!validateHuContentWord(m, w, { maxGraphemes: maxG })) continue;
    seen.add(w);
    out.push(w);
  }
  guard = 0;
  while (out.length < target && guard++ < 80_000) {
    const w = gen(rng);
    if (w.length < 3 || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function buildHuLexicon(
  seed: number,
  t: HuTuning,
  m: CorpusRuntimeModel | null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): HuLexicon {
  const sal = t.shape.posSalience;
  const maxG = maxGraphemesForBuild(m, t);
  const pb = quality.pieceBuiltLemmas;
  const rN = createRng(seed);
  const nouns = uniqueFill(
    rN,
    (rng) => {
      if (m && rng() < pb) {
        const w = genWordFromCorpus(m, rng, 3, maxG);
        if (validateHuContentWord(m, w, { maxGraphemes: maxG })) return w;
      }
      return fakeNounLemma(rng, sal);
    },
    t.fakeLexicon.nouns,
    m,
    maxG,
  );
  const rV = createRng(seed ^ 0x51ed);
  const verbStems = uniqueFill(
    rV,
    (rng) => {
      if (m && rng() < pb) {
        const w = genWordFromCorpus(m, rng, 2, maxG);
        if (validateHuContentWord(m, w, { maxGraphemes: maxG })) return w;
      }
      return fakeStem(rng, sal);
    },
    t.fakeLexicon.verbs,
    m,
    maxG,
  );
  let adjectives: string[] = [];
  if (t.fakeLexicon.adjectives > 0) {
    const rA = createRng(seed ^ 0xc001d);
    adjectives = uniqueFill(
      rA,
      (rng) => {
        if (m && rng() < pb) {
          const w = genWordFromCorpus(m, rng, 3, maxG);
          if (validateHuContentWord(m, w, { maxGraphemes: maxG })) return w;
        }
        return fakeAdjectiveHu(rng, sal);
      },
      t.fakeLexicon.adjectives,
      m,
      maxG,
    );
  }
  return { nouns, verbStems, adjectives };
}
