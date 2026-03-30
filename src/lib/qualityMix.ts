/**
 * Six “quality levers” (0–1 each) blending template synthesis with corpus-driven
 * behaviors. Defaults center at 0.5 per user preference.
 */
export type QualityMix = {
  /**
   * More → prepend short **attested-style** multi-word anchors (corpus n-gram words)
   * before synthesized clauses.
   */
  corpusChunks: number;
  /**
   * More → open-class lemmas skew toward **corpus n-gram-shaped** words (`genWordFromCorpus`);
   * less → purely phonotactic fake stems.
   */
  pieceBuiltLemmas: number;
  /**
   * More → sometimes replace a sentence with **whole-line corpus Markov** output
   * (word count + rhythm from `generateSentenceCorpus`).
   */
  corpusRhythm: number;
  /**
   * More → start from a **real snippet** (or Markov line) and **swap** content words
   * for fake lemmas.
   */
  sentenceSurgery: number;
  /**
   * More → generate **several** candidates per sentence and keep the best **corpus
   * transition** score.
   */
  multiCandidate: number;
  /**
   * More → clause-final punctuation sometimes follows **corpus-style** comma / semicolon
   * mix instead of only `.` / `?`.
   */
  punctuationRhythm: number;
};

export const DEFAULT_QUALITY_MIX: QualityMix = {
  corpusChunks: 0.5,
  pieceBuiltLemmas: 0.5,
  corpusRhythm: 0.5,
  sentenceSurgery: 0.5,
  multiCandidate: 0.5,
  punctuationRhythm: 0.5,
};

export function normalizeQualityMix(
  partial?: Partial<QualityMix> | null,
): QualityMix {
  return { ...DEFAULT_QUALITY_MIX, ...partial };
}
