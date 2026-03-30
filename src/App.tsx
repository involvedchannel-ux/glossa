import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  generatePremadeBlock,
  type CorpusBundle,
} from "./lib/generate";
import {
  LANGUAGES,
  type LanguageId,
  readStoredLanguage,
  writeStoredLanguage,
} from "./lib/language";
import {
  applyTheme,
  readStoredTheme,
  writeStoredTheme,
  type Theme,
} from "./lib/theme";
import {
  tryParseCorpusModel,
  type CorpusRuntimeModel,
} from "./lib/corpusModel";
import { DEFAULT_QUALITY_MIX } from "./lib/qualityMix";
import { OutputCard, type PreviewLayout } from "./components/OutputCard";
import { CustomGenerator } from "./components/CustomGenerator";
import { ThemeToggle } from "./components/ThemeToggle";

function previewLayoutFor(blockId: string): PreviewLayout {
  if (blockId === "title-subtitle") return "titleSubtitle";
  if (blockId === "title-subtitle-body") return "titleSubtitleBody";
  return "default";
}

function blockSeed(lang: LanguageId, blockId: string): number {
  let h = 2166136261;
  const s = `${lang}:${blockId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PREMADE: { id: string; title: string }[] = [
  { id: "para-short", title: "Short paragraph" },
  { id: "para-double", title: "Two paragraphs" },
  { id: "title-subtitle", title: "Title + subtitle" },
  { id: "title-subtitle-body", title: "Title + subtitle + paragraph" },
  { id: "bullets", title: "Bullet list (3–5 items)" },
  { id: "numbered", title: "Numbered list (5 items)" },
  { id: "dialog", title: "Dialog (two speakers)" },
];

const emptyCorpus: CorpusBundle = { hu: null, ro: null };

const QUALITY = DEFAULT_QUALITY_MIX;

export default function App() {
  const [lang, setLang] = useState<LanguageId>(() => readStoredLanguage() ?? "la");
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [corpus, setCorpus] = useState<CorpusBundle>(emptyCorpus);
  const [corpusStatus, setCorpusStatus] = useState<string | null>(null);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    writeStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    writeStoredLanguage(lang);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [huRes, roRes] = await Promise.all([
          fetch("/models/hu.json"),
          fetch("/models/ro.json"),
        ]);
        async function parseModel(res: Response): Promise<CorpusRuntimeModel | null> {
          if (!res.ok) return null;
          try {
            const j: unknown = await res.json();
            return tryParseCorpusModel(j);
          } catch {
            return null;
          }
        }
        const hu = await parseModel(huRes);
        const ro = await parseModel(roRes);
        if (!cancelled) {
          setCorpus({ hu, ro });
          setCorpusStatus(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCorpusStatus(
            e instanceof Error ? e.message : "Failed to load /models/*.json",
          );
          setCorpus(emptyCorpus);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelBanner = useMemo(() => {
    if (corpusStatus) return corpusStatus;
    if (lang === "hu" && !corpus.hu) {
      return "Magyar model missing or invalid (expected v4 hu.json). Run: npm run build-models";
    }
    return null;
  }, [corpusStatus, lang, corpus.hu]);

  const premadeTexts = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of PREMADE) {
      map.set(
        b.id,
        generatePremadeBlock(lang, b.id, blockSeed(lang, b.id), corpus, QUALITY),
      );
    }
    return map;
  }, [lang, corpus]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-intro">
          <h1 className="app-title">Glossa</h1>
          <p className="app-tagline">
            Placeholder text for typography — lorem-style samples in Latin, Magyar, and Română.
          </p>
        </div>
        <div className="header-toolbar">
          <ThemeToggle theme={theme} onChange={setTheme} />
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Content language"
          >
            {LANGUAGES.map((l) => (
              <label key={l.id} className="segmented-option">
                <input
                  type="radio"
                  name="glossa-lang"
                  value={l.id}
                  className="sr-only"
                  checked={lang === l.id}
                  onChange={() => setLang(l.id)}
                />
                <span className="segmented-label">{l.native}</span>
              </label>
            ))}
          </div>
        </div>
      </header>

      {modelBanner ? (
        <p className="app-status-banner" role="status">
          {modelBanner}
        </p>
      ) : null}

      <section aria-labelledby="premade-heading">
        <h2 id="premade-heading" className="section-label">
          Pre-made blocks
        </h2>
        <div className="block-list">
          {PREMADE.map((b) => {
            const text = premadeTexts.get(b.id) ?? "";
            return (
              <OutputCard
                key={b.id}
                title={b.title}
                text={text}
                previewLayout={previewLayoutFor(b.id)}
              />
            );
          })}
        </div>
      </section>

      <CustomGenerator lang={lang} corpus={corpus} quality={QUALITY} />

      <footer className="app-footer">
        <strong>Magyar</strong> and <strong>Română</strong> use template + fake lexicon with real
        closed-class words. <code>hu.json</code> and <code>ro.json</code> supply corpus-derived
        orthography hints when present.
      </footer>
    </div>
  );
}
