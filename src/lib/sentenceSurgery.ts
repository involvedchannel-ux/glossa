import {
  generateSentenceCorpus,
  validateHuContentWord,
  type CorpusRuntimeModel,
} from "./corpusModel";
import type { PRNG } from "./markov";

function tokenParts(word: string): { lead: string; core: string; trail: string } {
  let a = 0;
  let b = word.length;
  while (a < b && !/[\p{L}]/u.test(word[a]!)) a++;
  while (b > a && !/[\p{L}]/u.test(word[b - 1]!)) b--;
  return {
    lead: word.slice(0, a),
    core: word.slice(a, b),
    trail: word.slice(b),
  };
}

function isReplaceableCore(core: string): boolean {
  if (core.length < 3 || core.length > 24) return false;
  return /^[\p{L}\-]+$/u.test(core);
}

/**
 * Start from a real snippet (if present) or a corpus Markov sentence, then swap
 * content-word cores for fake lemmas. `replaceStrength` is typically the UI slider (0–1).
 */
export function sentenceFromSurgery(
  m: CorpusRuntimeModel,
  rng: PRNG,
  pickNoun: () => string,
  pickVerb: () => string,
  pickAdj: () => string,
  replaceStrength: number,
): string {
  const bank = m.snippets.length > 0 ? m.snippets : null;
  const base = bank
    ? bank[Math.floor(rng() * bank.length)]!
    : generateSentenceCorpus(m, rng, 5 + Math.floor(rng() * 8));

  const words = base.split(/\s+/).filter(Boolean);
  let turn = 0;
  const out: string[] = [];
  for (const w of words) {
    const { lead, core, trail } = tokenParts(w);
    if (
      !isReplaceableCore(core) ||
      rng() > Math.min(0.92, 0.35 + replaceStrength * 0.65)
    ) {
      out.push(w);
      continue;
    }
    const slot = turn++ % 5;
    const fake =
      slot === 1
        ? pickVerb()
        : slot === 3
          ? pickAdj()
          : pickNoun();
    out.push(lead + fake + trail);
  }
  if (m.language === "hu") {
    const maxG = m.maxWordGraphemes;
    for (let i = 0; i < out.length; i++) {
      const { lead, core, trail } = tokenParts(out[i]!);
      if (!isReplaceableCore(core)) continue;
      const low = core.normalize("NFC").toLowerCase();
      if (validateHuContentWord(m, low, { maxGraphemes: maxG })) continue;
      const slot = i % 5;
      const fake =
        slot === 1 ? pickVerb() : slot === 3 ? pickAdj() : pickNoun();
      out[i] = lead + fake + trail;
    }
  }
  const joined = out.join(" ");
  const cp = [...joined];
  if (cp.length === 0) return joined;
  if (m.language === "hu") {
    return cp[0]!.toLocaleUpperCase("hu-HU") + cp.slice(1).join("");
  }
  const roUp: Record<string, string> = {
    î: "Î",
    ș: "Ș",
    ț: "Ț",
    ă: "Ă",
    â: "Â",
  };
  const f = cp[0]!;
  const u = roUp[f] ?? f.toLocaleUpperCase("ro");
  return u + cp.slice(1).join("");
}
