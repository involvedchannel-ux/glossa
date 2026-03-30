import { useMemo, useState } from "react";
import type { LanguageId } from "../lib/language";
import type {
  CorpusBundle,
  CustomStructure,
  LengthPreset,
} from "../lib/generate";
import { generateCustom } from "../lib/generate";
import type { QualityMix } from "../lib/qualityMix";
import { OutputCard } from "./OutputCard";

function hashSeed(parts: string): number {
  let h = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type CustomGeneratorProps = {
  lang: LanguageId;
  corpus: CorpusBundle;
  quality: QualityMix;
};

const STRUCTURES: { id: CustomStructure; label: string }[] = [
  { id: "paragraph", label: "Paragraph" },
  { id: "bullets", label: "Bullet list" },
  { id: "numbered", label: "Numbered list" },
  { id: "dialog", label: "Dialog" },
  { id: "mixed", label: "Mixed" },
];

export function CustomGenerator({
  lang,
  corpus,
  quality,
}: CustomGeneratorProps) {
  const [structure, setStructure] = useState<CustomStructure>("paragraph");
  const [quantity, setQuantity] = useState(3);
  const [length, setLength] = useState<LengthPreset>("medium");
  const [extraSeed, setExtraSeed] = useState(0);

  const output = useMemo(() => {
    const base = hashSeed(
      `${lang}|${structure}|${quantity}|${length}|${extraSeed}`,
    );
    return generateCustom({
      lang,
      structure,
      quantity,
      length,
      seed: base,
      corpus,
      quality,
    });
  }, [lang, structure, quantity, length, extraSeed, corpus, quality]);

  const qMin = 1;
  const qMax = structure === "dialog" ? 20 : 12;

  return (
    <section aria-labelledby="custom-heading">
      <h2 id="custom-heading" className="section-label">
        Custom generator
      </h2>
      <div className="form-panel card">
        <div className="form-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label" id="structure-label">
              Structure
            </span>
            <div className="radio-row" role="radiogroup" aria-labelledby="structure-label">
              {STRUCTURES.map((s) => (
                <label key={s.id} className="radio-pill">
                  <input
                    type="radio"
                    name="structure"
                    value={s.id}
                    checked={structure === s.id}
                    onChange={() => setStructure(s.id)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="qty">
              {structure === "dialog"
                ? "Exchanges"
                : structure === "paragraph"
                  ? "Paragraphs"
                  : "Items"}
            </label>
            <input
              id="qty"
              type="number"
              min={qMin}
              max={qMax}
              value={quantity}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n))
                  setQuantity(Math.min(qMax, Math.max(qMin, n)));
              }}
            />
          </div>
          <div className="field">
            <span className="field-label" id="length-label">
              Length
            </span>
            <div
              className="length-seg"
              role="group"
              aria-labelledby="length-label"
            >
              {(["short", "medium", "long"] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  data-active={length === len}
                  onClick={() => setLength(len)}
                >
                  {len === "short" ? "Short" : len === "medium" ? "Medium" : "Long"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setExtraSeed((s) => s + 1)}
          >
            Regenerate
          </button>
        </div>
      </div>
      <OutputCard title="Output" text={output} />
    </section>
  );
}
