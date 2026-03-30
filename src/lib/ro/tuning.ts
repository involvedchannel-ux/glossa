/**
 * Romanian synthesis tuning — mirrors docs/language-engine/tuning.md (GLOSSA_RO line).
 */

export type RoTuning = {
  fakeLexicon: {
    nouns: number;
    verbs: number;
    adjectives: number;
    surfaceMultiplier: number;
  };
  closedClass: { purity: number };
  template: {
    depth: number;
    diversity: number;
    /** Base rate for interrogative / WH-heavy schemata; effective rate × (1 − declarativeBias). */
    interrogativeRate: number;
    /** Higher → more declarative sentences (fewer questions). */
    declarativeBias: number;
  };
  /** Open-class word silhouette + length. */
  shape: {
    posSalience: number;
    spellingCapScale: number;
  };
  agreement: { strictness: number };
  repetition: { penalty: number };
  phonotactics: { strength: number };
};

/**
 * GLOSSA_RO: … int=0.26 db=0.58 pos=0.74 cap=0.86
 * (plus lexicon / depth / div / agr / rep / phono)
 */
export const RO_TUNING: RoTuning = {
  fakeLexicon: {
    nouns: 500,
    verbs: 500,
    adjectives: 150,
    surfaceMultiplier: 1,
  },
  closedClass: { purity: 1 },
  template: {
    depth: 0.45,
    diversity: 18,
    interrogativeRate: 0.26,
    declarativeBias: 0.58,
  },
  shape: {
    posSalience: 0.74,
    spellingCapScale: 0.86,
  },
  agreement: { strictness: 0 },
  repetition: { penalty: 0.35 },
  phonotactics: { strength: 0 },
};

export function formatRoTuningPreset(t: RoTuning = RO_TUNING): string {
  return (
    `GLOSSA_RO: nouns=${t.fakeLexicon.nouns} ` +
    `verbs=${t.fakeLexicon.verbs} ` +
    `adj=${t.fakeLexicon.adjectives} ` +
    `surf=${t.fakeLexicon.surfaceMultiplier} ` +
    `closed=${t.closedClass.purity} ` +
    `depth=${t.template.depth} ` +
    `div=${t.template.diversity} ` +
    `int=${t.template.interrogativeRate} ` +
    `db=${t.template.declarativeBias} ` +
    `pos=${t.shape.posSalience} ` +
    `cap=${t.shape.spellingCapScale} ` +
    `agr=${t.agreement.strictness} ` +
    `rep=${t.repetition.penalty} ` +
    `phono=${t.phonotactics.strength}`
  );
}
