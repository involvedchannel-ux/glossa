/**
 * Hungarian multigraphs (one letter) — longest match first.
 * @see https://en.wikipedia.org/wiki/Hungarian_alphabet
 */
const DIGRAPHS = ["dzs", "dz", "sz", "cs", "gy", "ly", "ny", "ty", "zs"];

const HU_SINGLE_LETTERS = new Set(
  "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz".split(""),
);

/**
 * @param {string} text — already lowercased, NFC, letters + spaces only
 * @returns {string[]}
 */
export function tokenizeHungarian(text) {
  const out = [];
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === " ") {
      out.push(" ");
      i += 1;
      continue;
    }
    let matched = false;
    for (const g of DIGRAPHS) {
      if (text.startsWith(g, i)) {
        out.push(g);
        i += g.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (HU_SINGLE_LETTERS.has(ch)) {
      out.push(ch);
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

const PUA_BASE = 0xe000;

/** @param {string[]} tokens @param {Map<string, number>} tokenToId */
export function tokensToPuaString(tokens, tokenToId) {
  let s = "";
  for (const t of tokens) {
    const id = tokenToId.get(t);
    if (id === undefined) continue;
    s += String.fromCodePoint(PUA_BASE + id);
  }
  return s;
}

/** @param {string} pua @param {string[]} idToToken */
export function puaStringToTokens(pua, idToToken) {
  const out = [];
  for (const c of pua) {
    const cp = c.codePointAt(0);
    if (cp === undefined) continue;
    const id = cp - PUA_BASE;
    const tok = idToToken[id];
    if (tok !== undefined) out.push(tok);
  }
  return out;
}

export function buildHungarianTokenTable() {
  const singles = [...HU_SINGLE_LETTERS].sort();
  const tokens = [" ", ...singles, ...DIGRAPHS];
  /** @type {Map<string, number>} */
  const tokenToId = new Map();
  tokens.forEach((t, i) => tokenToId.set(t, i));
  return { tokens, tokenToId, PUA_BASE, idToToken: tokens };
}

export { PUA_BASE };
