import {
  generateSentenceCorpus,
  genWordFromCorpus,
  sampleClausePunctFromCorpus,
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
  capitalizeRo,
  pick,
  RO_AUX,
  RO_CONJ_COMMA,
  RO_CONJ_NO_COMMA,
  RO_COPULA_FIN,
  RO_DEM,
  RO_DET_INDEF,
  RO_PREP,
  RO_PRON_SUBJ,
  RO_Q,
  RO_SUBORD_AFTER_COMMA,
} from "./closedClass";
import { finalizeRomanianParagraph } from "./sanitize";
import {
  applyDefinite,
  applyPlural,
  fakeAdjective,
  finiteVerbFromStem,
} from "./fakeWord";
import { buildRoLexicon, type RoLexicon } from "./lexicon";
import { RO_TUNING, type RoTuning } from "./tuning";

type PickPools = {
  noun: () => string;
  verb: () => string;
  adj: () => string;
};

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
  lex: RoLexicon,
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
      : () => fakeAdjective(rng, posSalience);
  return {
    noun: pickNoun,
    verb: () => finiteVerbFromStem(pickStem(), rng, m, posSalience),
    adj: pickAdj,
  };
}

function declarativeEndPunct(rng: PRNG, _t: RoTuning, q: QualityMix): string {
  if (rng() < q.punctuationRhythm * 0.42) {
    return rng() < 0.1 ? "!" : ".";
  }
  return ".";
}

function interrogativeEndPunct(rng: PRNG, q: QualityMix): string {
  if (rng() < q.punctuationRhythm * 0.18) {
    return sampleClausePunctFromCorpus(rng) === "!" ? "!" : "?";
  }
  return "?";
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
  tuning: RoTuning,
  quality: QualityMix,
) => string;

function buildDeclarativeTemplates(): Tpl[] {
  return [
    (s, r, _m, t, q) =>
      `${pick(r, RO_DET_INDEF)} ${s.noun()} ${s.verb()} ${pick(r, RO_PREP)} ${pick(r, RO_DET_INDEF)} ${s.noun()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `dar ${applyDefinite(s.noun(), r, m)}, ${pick(r, RO_CONJ_COMMA)} ${pick(r, RO_PRON_SUBJ)} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${capitalizeRo(pick(r, RO_PREP))} ${applyDefinite(s.noun(), r, m)} ${pick(r, RO_PRON_SUBJ)} ${pick(r, RO_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `nu ${pick(r, RO_PRON_SUBJ)} ${s.verb()} ${pick(r, RO_PREP)} ${applyDefinite(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `fie ${s.noun()}, fie ${s.noun()}, ${pick(r, RO_PRON_SUBJ)} ${pick(r, RO_AUX)} ${s.adj()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `${pick(r, RO_DEM)} ${s.noun()} ${pick(r, RO_CONJ_NO_COMMA)} ${pick(r, RO_DET_INDEF)} ${s.noun()} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${capitalizeRo(applyDefinite(s.noun(), r, m))} ${s.verb()} ${pick(r, RO_PREP)} ${s.noun()}, ${pick(r, RO_CONJ_COMMA)} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `au ${s.verb()} ${applyPlural(s.noun(), r, m)} ${pick(r, RO_PREP)} ${applyDefinite(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${capitalizeRo(applyPlural(s.noun(), r, m))} ${pick(r, RO_COPULA_FIN)} ${s.adj()}, ${pick(r, RO_CONJ_COMMA)} ${applyDefinite(s.noun(), r, m)} nu ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `în ${s.noun()}, ${pick(r, RO_DET_INDEF)} ${s.noun()} ${s.verb()} mereu${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `pentru ${s.noun()}, ${pick(r, RO_PRON_SUBJ)} ${s.verb()} ${pick(r, RO_PREP)} ${applyDefinite(s.noun(), r, m)}${declarativeEndPunct(r, t, q)}`,
    (s, r, m, t, q) =>
      `${capitalizeRo(s.adj())}! ${capitalizeRo(pick(r, RO_DET_INDEF))} ${applyDefinite(s.noun(), r, m)} nu ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `${pick(r, RO_DET_INDEF)} ${s.adj()} ${s.noun()} ${s.verb()} ${pick(r, RO_PREP)} ${pick(r, RO_DET_INDEF)} ${s.noun()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `${pick(r, RO_PRON_SUBJ)} ${s.verb()} ${pick(r, RO_DET_INDEF)} ${s.adj()} ${s.noun()}, ${pick(r, RO_CONJ_COMMA)} ${pick(r, RO_PRON_SUBJ)} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
    (s, r, _m, t, q) =>
      `${s.noun()} ${s.verb()}, ${pick(r, RO_SUBORD_AFTER_COMMA)} ${pick(r, RO_PRON_SUBJ)} ${s.verb()}${declarativeEndPunct(r, t, q)}`,
  ];
}

function buildInterrogativeTemplates(): Tpl[] {
  return [
    (s, r, _m, _t, q) =>
      `${pick(r, RO_Q)} ${s.verb()} ${pick(r, RO_PREP)} ${pick(r, RO_DET_INDEF)} ${s.noun()}${interrogativeEndPunct(r, q)}`,
    (s, r, _m, _t, q) =>
      `când ${pick(r, RO_PRON_SUBJ)} ${s.verb()}, ${pick(r, RO_DET_INDEF)} ${s.noun()} ${pick(r, RO_AUX)} ${s.adj()}${interrogativeEndPunct(r, q)}`,
    (s, r, m, _t, q) =>
      `${pick(r, RO_Q)} ${pick(r, RO_AUX)} ${s.adj()} ${applyDefinite(s.noun(), r, m)}${interrogativeEndPunct(r, q)}`,
    (s, r, _m, _t, q) =>
      `dacă ${pick(r, RO_PRON_SUBJ)} ${s.verb()}, atunci ${pick(r, RO_DET_INDEF)} ${s.noun()} ${pick(r, RO_AUX)} ${s.adj()}${interrogativeEndPunct(r, q)}`,
    (s, r, _m, _t, q) =>
      `unde ${s.verb()} ${pick(r, RO_DET_INDEF)} ${s.noun()} ${pick(r, RO_PREP)} ${s.noun()}${interrogativeEndPunct(r, q)}`,
    (s, r, m, _t, q) =>
      `care dintre ${applyPlural(s.noun(), r, m)} ${pick(r, RO_AUX)} mai ${s.adj()}${interrogativeEndPunct(r, q)}`,
  ];
}

const DECL_TEMPLATES = buildDeclarativeTemplates();
const INT_TEMPLATES = buildInterrogativeTemplates();

function effectivePoolCount(poolLen: number, tuning: RoTuning): number {
  if (poolLen <= 0) return 1;
  const div = Math.max(1, Math.min(tuning.template.diversity, poolLen));
  const d = tuning.template.depth;
  const extra = Math.round(d * Math.max(0, poolLen - div));
  return Math.max(1, Math.min(poolLen, div + extra));
}

function pickTemplateWithAvoid(
  rng: PRNG,
  tuning: RoTuning,
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

function produceOneSentenceRo(
  rng: PRNG,
  pools: PickPools,
  tuning: RoTuning,
  roModel: CorpusRuntimeModel | null,
  avoid: TemplatePickMeta | null,
  quality: QualityMix,
): { raw: string; meta: TemplatePickMeta } {
  if (roModel && rng() < quality.corpusRhythm) {
    const raw = generateSentenceCorpus(
      roModel,
      rng,
      5 + Math.floor(rng() * 9),
    );
    return {
      raw,
      meta: { pool: "markov", index: Math.floor(rng() * 1e9) },
    };
  }
  if (roModel && rng() < quality.sentenceSurgery) {
    const raw = sentenceFromSurgery(
      roModel,
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
  const raw = tpl(pools, rng, roModel, tuning, quality);
  return { raw, meta };
}

function runSentenceRo(
  rng: PRNG,
  lex: RoLexicon,
  tuning: RoTuning,
  roModel: CorpusRuntimeModel | null,
  avoid: TemplatePickMeta | null,
  quality: QualityMix,
): { text: string; meta: TemplatePickMeta } {
  const q = normalizeQualityMix(quality);
  const pools = buildPickers(
    lex,
    rng,
    tuning.repetition.penalty,
    roModel,
    tuning.shape.posSalience,
  );
  const k = 1 + Math.floor(q.multiCandidate * 7);
  let bestRaw = "";
  let bestMeta: TemplatePickMeta = { pool: "decl", index: 0 };
  let bestScore = -1e15;
  for (let c = 0; c < k; c++) {
    const { raw, meta } = produceOneSentenceRo(
      rng,
      pools,
      tuning,
      roModel,
      avoid,
      q,
    );
    const sc = roModel ? scoreSentenceByModel(roModel, raw) : 0;
    if (sc > bestScore) {
      bestScore = sc;
      bestRaw = raw;
      bestMeta = meta;
    }
  }
  const merged = maybeCorpusChunkPrefix(roModel, rng, q, bestRaw);
  return { text: finalizeRomanianParagraph(merged, roModel, rng), meta: bestMeta };
}

export function generateSentenceRo(
  rng: PRNG,
  lex: RoLexicon,
  tuning: RoTuning = RO_TUNING,
  roModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  return runSentenceRo(rng, lex, tuning, roModel, null, quality).text;
}

export function generateParagraphRo(
  rng: PRNG,
  lex: RoLexicon,
  sentenceCount: number,
  tuning: RoTuning = RO_TUNING,
  roModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const parts: string[] = [];
  let prev: TemplatePickMeta | null = null;
  for (let i = 0; i < sentenceCount; i++) {
    const { text, meta } = runSentenceRo(
      rng,
      lex,
      tuning,
      roModel,
      prev,
      quality,
    );
    prev = meta;
    parts.push(text);
  }
  return parts.join(" ");
}

export function roLexiconForSeed(
  seed: number,
  tuning: RoTuning = RO_TUNING,
  roModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): RoLexicon {
  return buildRoLexicon(seed ^ 0xfeed1234, tuning, roModel, quality);
}

export function generateRoPremadeParagraph(
  seed: number,
  sentenceCount: number,
  tuning: RoTuning = RO_TUNING,
  roModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const rng = createRng(seed);
  const lex = roLexiconForSeed(seed, tuning, roModel, quality);
  return generateParagraphRo(rng, lex, sentenceCount, tuning, roModel, quality);
}

export function generateRoPremadeSentence(
  seed: number,
  _wordBudget: number,
  tuning: RoTuning = RO_TUNING,
  roModel: CorpusRuntimeModel | null = null,
  quality: QualityMix = DEFAULT_QUALITY_MIX,
): string {
  const rng = createRng(seed);
  const lex = roLexiconForSeed(seed, tuning, roModel, quality);
  return generateSentenceRo(rng, lex, tuning, roModel, quality);
}
