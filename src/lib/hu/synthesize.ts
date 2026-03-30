import {
  generateSentenceCorpus,
  genWordFromCorpus,
  scoreSentenceByModel,
  type CorpusRuntimeModel,
} from "../corpusModel";
import { createRng, type PRNG } from "../markov";
import {
  DEFAULT_QUALITY_MIX,
  normalizeQualityMix,
  type QualityMix,
} from "../qualityMix";
import { sentenceFromSurgery } from "../sentenceSurgery";
import {
  capitalizeHu,
  pick,
  HU_AUX,
  HU_CONJ,
  HU_COP,
  HU_PRON,
  HU_Q,
  HU_SUBORD_AFTER_COMMA,
  HU_SUBORD_SENTENCE_INITIAL,
} from "./closedClass";
import { finalizeHungarianSentence } from "./sanitize";
import {
  demonstrativeNounPhrase,
  pickHuDeterminer,
} from "./grammar";
import {
  applyDefiniteHu,
  applyPluralHu,
  fakeAdjectiveHu,
  finiteVerbFromStemHu,
  fuseNounWithOblique,
} from "./fakeWord";
import { buildHuLexicon, type HuLexicon } from "./lexicon";
import { HU_TUNING, type HuTuning } from "./tuning";

type PickPools = {
  noun: () => string;
  verb: () => string;
  adj: () => string;
};

/** Identifies last chosen path so paragraphs can avoid immediate template repeats. */
type TemplatePickMeta =
  | { pool: "decl" | "int"; index: number }
  | { pool: "markov" | "surgery"; index: number };

function makePoolPicker<T>(
  pool: readonly T[],
  rng: PRNG,
  penalty: number,
): () => T {
  const recent: number[] = [];
  return () => {
    for (let k = 0; k < 28; k++) {
      const i = Math.floor(rng() * pool.length);
      if (recent.includes(i) && rng() < penalty) continue;
      recent.push(i);
      if (recent.length > 12) recent.shift();
      return pool[i]!;
    }
    return pool[Math.floor(rng() * pool.length)]!;
  };
}

function buildPickers(
  lex: HuLexicon,
  rng: PRNG,
  penalty: number,
  m: CorpusRuntimeModel | null,
  posSalience: number,
): PickPools {
  const pickNoun = makePoolPicker(lex.nouns, rng, penalty);
  const pickStem = makePoolPicker(lex.verbStems, rng, penalty);
  const pickAdj =
    lex.adjectives.length > 0
      ? makePoolPicker(lex.adjectives, rng, penalty)
      : () => fakeAdjectiveHu(rng, posSalience);
  return {
    noun: pickNoun,
    verb: () => finiteVerbFromStemHu(pickStem(), rng, m, posSalience),
    adj: pickAdj,
  };
}

/** Declarative sentences: **.** or **!** only — `?` is reserved for interrogative-initial clauses (see `finalizeHungarianSentence`). */
function declarativeEndPunct(rng: PRNG, _t: HuTuning, q: QualityMix): string {
  if (rng() < q.punctuationRhythm * 0.2) {
    return rng() < 0.09 ? "!" : ".";
  }
  return ".";
}

function maybeCorpusChunkPrefix(
  m: CorpusRuntimeModel | null,
  rng: PRNG,
  q: QualityMix,
  sentence: string,
): string {
  if (!m || q.corpusChunks <= 0 || rng() > q.corpusChunks * 0.88) {
    return sentence;
  }
  const maxG = m.maxWordGraphemes;
  const w1 = genWordFromCorpus(m, rng, 3, Math.min(8, maxG));
  const w2 = genWordFromCorpus(m, rng, 2, Math.min(7, maxG));
  return `${w1} ${w2}. ${sentence}`;
}

type Tpl = (
  p: PickPools,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
  tuning: HuTuning,
  quality: QualityMix,
) => string;

function buildDeclarativeTemplates(): Tpl[] {
  return [
    (s, r, m, t, q) => {
      const n1 = s.noun();
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `${pickHuDeterminer(r, n1)} ${n1} ${s.verb()} ${pickHuDeterminer(r, obl)} ${obl}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) =>
      `de ${applyDefiniteHu(s.noun(), r, m)} ${pick(r, HU_CONJ)} ${pick(r, HU_PRON)} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) => {
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `${capitalizeHu(pickHuDeterminer(r, obl))} ${obl} ${pick(r, HU_PRON)} ${pick(r, HU_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) =>
      `nem ${pick(r, HU_PRON)} ${s.verb()} ${fuseNounWithOblique(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `legyen ${s.noun()} vagy ${s.noun()}, ${pick(r, HU_PRON)} ${pick(r, HU_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) => {
      const n1 = s.noun();
      const n2 = s.noun();
      return `${demonstrativeNounPhrase(r, n1)} ${pick(r, HU_CONJ)} ${pickHuDeterminer(r, n2)} ${n2} ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) => {
      const w = applyDefiniteHu(s.noun(), r, m);
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `${capitalizeHu(w)} ${s.verb()} ${obl}, ${pick(r, HU_CONJ)} ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) =>
      `és ${s.verb()} ${applyPluralHu(s.noun(), r, m)} ${fuseNounWithOblique(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${capitalizeHu(applyPluralHu(s.noun(), r, m))} ${pick(r, HU_COP)} ${s.adj()}, ${pick(r, HU_CONJ)} ${applyDefiniteHu(s.noun(), r, m)} nem ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) => {
      const n2 = s.noun();
      return `${s.noun()} mellett ${pickHuDeterminer(r, n2)} ${n2} ${s.verb()} mindig${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) =>
      `${s.noun()} miatt ${pick(r, HU_PRON)} ${s.verb()} ${fuseNounWithOblique(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${s.noun()} következtében ${pick(r, HU_PRON)} ${s.verb()} ${fuseNounWithOblique(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `mert ${s.noun()}, ${pick(r, HU_PRON)} ${s.verb()} ${fuseNounWithOblique(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) => {
      const w = applyDefiniteHu(s.noun(), r, m);
      return `${capitalizeHu(s.adj())}! ${capitalizeHu(pickHuDeterminer(r, w))} ${w} nem ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, m, t, q) => {
      const adj = s.adj();
      const n = s.noun();
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `${pickHuDeterminer(r, adj)} ${adj} ${n} ${s.verb()} ${pickHuDeterminer(r, obl)} ${obl}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, _m, t, q) => {
      const adj = s.adj();
      const n = s.noun();
      return `${pick(r, HU_PRON)} ${s.verb()} ${pickHuDeterminer(r, adj)} ${adj} ${n} ${pick(r, HU_CONJ)} ${pick(r, HU_PRON)} ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, _m, t, q) => {
      const n1 = s.noun();
      return `${n1} ${s.verb()}, ${pick(r, HU_SUBORD_AFTER_COMMA)} ${pick(r, HU_PRON)} ${pick(r, HU_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, _m, t, q) => {
      const n1 = s.noun();
      return `${n1} ${s.verb()}, ha ${pick(r, HU_PRON)} ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, _m, t, q) => {
      const sub = pick(r, [...HU_SUBORD_SENTENCE_INITIAL]);
      const n = s.noun();
      return `${capitalizeHu(sub)} ${pick(r, HU_PRON)} ${s.verb()}, ${pickHuDeterminer(r, n)} ${n} ${pick(r, HU_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`;
    },
    (s, r, _m, t, q) => {
      const sub = pick(r, [...HU_SUBORD_SENTENCE_INITIAL]);
      const n1 = s.noun();
      return `${capitalizeHu(sub)} ${pick(r, HU_PRON)} ${s.verb()} ${n1}, ${pick(r, HU_PRON)} ${s.verb()}${declarativeEndPunct(r, t, q)}`;
    },
  ];
}

function buildInterrogativeTemplates(): Tpl[] {
  return [
    (s, r, m, _t, _q) => {
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `${pick(r, HU_Q)} ${s.verb()} ${pickHuDeterminer(r, obl)} ${obl}?`;
    },
    (s, r, _m, _t, _q) => {
      const n = s.noun();
      return `amikor ${pick(r, HU_PRON)} ${s.verb()}, ${pickHuDeterminer(r, n)} ${n} ${pick(r, HU_AUX)} ${s.adj()}?`;
    },
    (s, r, m, _t, _q) => {
      const w = applyDefiniteHu(s.noun(), r, m);
      return `${pick(r, HU_Q)} ${pick(r, HU_AUX)} ${s.adj()} ${w}?`;
    },
    (s, r, _m, _t, _q) => {
      const n = s.noun();
      return `ha ${pick(r, HU_PRON)} ${s.verb()}, akkor ${pickHuDeterminer(r, n)} ${n} ${pick(r, HU_AUX)} ${s.adj()}?`;
    },
    (s, r, m, _t, _q) => {
      const obl = fuseNounWithOblique(s.noun(), r, m);
      return `hol ${s.verb()} ${pickHuDeterminer(r, obl)} ${obl}?`;
    },
    (s, r, m, _t, _q) =>
      `melyik ${applyPluralHu(s.noun(), r, m)} ${pick(r, HU_AUX)} inkább ${s.adj()}?`,
  ];
}

const DECL_TEMPLATES = buildDeclarativeTemplates();
const INT_TEMPLATES = buildInterrogativeTemplates();

function effectivePoolCount(poolLen: number, tuning: HuTuning): number {
  if (poolLen <= 0) return 1;
  const div = Math.max(1, Math.min(tuning.template.diversity, poolLen));
  const d = tuning.template.depth;
  const extra = Math.round(d * Math.max(0, poolLen - div));
  return Math.max(1, Math.min(poolLen, div + extra));
}

function pickTemplateWithAvoid(
  rng: PRNG,
  tuning: HuTuning,
  prev: TemplatePickMeta | null,
): { tpl: Tpl; meta: TemplatePickMeta } {
  const pInt =
    tuning.template.interrogativeRate *
    Math.max(0, 1 - tuning.template.declarativeBias);

  for (let attempt = 0; attempt < 14; attempt++) {
    const pool: "decl" | "int" =
      INT_TEMPLATES.length > 0 && rng() < pInt ? "int" : "decl";
    const list = pool === "int" ? INT_TEMPLATES : DECL_TEMPLATES;
    const n = effectivePoolCount(list.length, tuning);
    let index = Math.floor(rng() * n);

    const clashes =
      prev &&
      (prev.pool === "decl" || prev.pool === "int") &&
      prev.pool === pool &&
      prev.index === index;

    if (clashes && n > 1) {
      let tries = 0;
      while (
        prev &&
        prev.pool === pool &&
        prev.index === index &&
        tries++ < 10
      ) {
        index = Math.floor(rng() * n);
      }
    }

    if (
      prev &&
      (prev.pool === "decl" || prev.pool === "int") &&
      prev.pool === pool &&
      prev.index === index
    ) {
      const alt: "decl" | "int" = pool === "int" ? "decl" : "int";
      const list2 = alt === "int" ? INT_TEMPLATES : DECL_TEMPLATES;
      if (list2.length > 0) {
        const n2 = effectivePoolCount(list2.length, tuning);
        const index2 = Math.floor(rng() * n2);
        return { tpl: list2[index2]!, meta: { pool: alt, index: index2 } };
      }
    }

    return { tpl: list[index]!, meta: { pool, index } };
  }

  const n = effectivePoolCount(DECL_TEMPLATES.length, tuning);
  const index = Math.floor(rng() * n);
  return {
    tpl: DECL_TEMPLATES[index]!,
    meta: { pool: "decl", index },
  };
}

function produceOneSentenceHu(
  rng: PRNG,
  pools: PickPools,
  tuning: HuTuning,
  huModel: CorpusRuntimeModel | null,
  avoid: TemplatePickMeta | null,
  quality: QualityMix,
): { raw: string; meta: TemplatePickMeta } {
  if (huModel && rng() < quality.corpusRhythm) {
    const raw = generateSentenceCorpus(
      huModel,
      rng,
      5 + Math.floor(rng() * 9),
    );
    return {
      raw,
      meta: { pool: "markov", index: Math.floor(rng() * 1e9) },
    };
  }
  if (huModel && rng() < quality.sentenceSurgery) {
    const raw = sentenceFromSurgery(
      huModel,
      rng,
      pools.noun,
      pools.verb,
      pools.adj,
      quality.sentenceSurgery,
    );
    return {
      raw,
      meta: { pool: "surgery", index: Math.floor(rng() * 1e9) },
    };
  }
  const { tpl, meta } = pickTemplateWithAvoid(rng, tuning, avoid);
  const raw = tpl(pools, rng, huModel, tuning, quality);
  return { raw, meta };
}

function runSentenceHu(
  rng: PRNG,
  lex: HuLexicon,
  tuning: HuTuning,
  huModel: CorpusRuntimeModel | null,
  avoid: TemplatePickMeta | null,
  quality: QualityMix,
): { text: string; meta: TemplatePickMeta } {
  const q = normalizeQualityMix(quality);
  const pools = buildPickers(
    lex,
    rng,
    tuning.repetition.penalty,
    huModel,
    tuning.shape.posSalience,
  );
  const k = 1 + Math.floor(q.multiCandidate * 7);
  let bestRaw = "";
  let bestMeta: TemplatePickMeta = { pool: "decl", index: 0 };
  let bestScore = -1e15;
  for (let c = 0; c < k; c++) {
    const { raw, meta } = produceOneSentenceHu(
      rng,
      pools,
      tuning,
      huModel,
      avoid,
      q,
    );
    const sc = huModel ? scoreSentenceByModel(huModel, raw) : 0;
    if (sc > bestScore) {
      bestScore = sc;
      bestRaw = raw;
      bestMeta = meta;
    }
  }
  const merged = maybeCorpusChunkPrefix(huModel, rng, q, bestRaw);
  return {
    text: finalizeHungarianSentence(merged, huModel, rng),
    meta: bestMeta,
  };
}

export function generateSentenceHu(
  rng: PRNG,
  lex: HuLexicon,
  tuning: HuTuning = HU_TUNING,
  huModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  return runSentenceHu(rng, lex, tuning, huModel, null, quality).text;
}

export function generateParagraphHu(
  rng: PRNG,
  lex: HuLexicon,
  sentenceCount: number,
  tuning: HuTuning = HU_TUNING,
  huModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const parts: string[] = [];
  let prev: TemplatePickMeta | null = null;
  for (let i = 0; i < sentenceCount; i++) {
    const { text, meta } = runSentenceHu(
      rng,
      lex,
      tuning,
      huModel,
      prev,
      quality,
    );
    prev = meta;
    parts.push(text);
  }
  return parts.join(" ");
}

export function huLexiconForSeed(
  seed: number,
  tuning: HuTuning = HU_TUNING,
  huModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): HuLexicon {
  return buildHuLexicon(seed ^ 0xfeed1234, tuning, huModel, quality);
}

export function generateHuPremadeParagraph(
  seed: number,
  sentenceCount: number,
  tuning: HuTuning = HU_TUNING,
  huModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const rng = createRng(seed);
  const lex = huLexiconForSeed(seed, tuning, huModel, quality);
  return generateParagraphHu(rng, lex, sentenceCount, tuning, huModel, quality);
}

export function generateHuPremadeSentence(
  seed: number,
  _wordBudget: number,
  tuning: HuTuning = HU_TUNING,
  huModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const rng = createRng(seed);
  const lex = huLexiconForSeed(seed, tuning, huModel, quality);
  return generateSentenceHu(rng, lex, tuning, huModel, quality);
}
