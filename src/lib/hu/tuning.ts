/**
 * Hungarian template tuning — same knob names as RO; see docs/language-engine/tuning.md.
 */

export type HuTuning = {
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
    interrogativeRate: number;
    declarativeBias: number;
  };
  shape: {
    posSalience: number;
    spellingCapScale: number;
  };
  agreement: { strictness: number };
  repetition: { penalty: number };
  phonotactics: { strength: number };
};

export const HU_TUNING: HuTuning = {
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

export function formatHuTuningPreset(t: HuTuning = HU_TUNING): string {
  return (
    `GLOSSA_HU: nouns=${t.fakeLexicon.nouns} ` +
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
