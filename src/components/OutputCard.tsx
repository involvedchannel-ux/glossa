import { useState } from "react";
import { countText } from "../lib/counts";

export type PreviewLayout = "default" | "titleSubtitle" | "titleSubtitleBody";

type OutputCardProps = {
  title: string;
  text: string;
  previewLayout?: PreviewLayout;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function renderPreview(text: string, layout: PreviewLayout) {
  if (layout === "titleSubtitle") {
    const nl = text.indexOf("\n");
    const titleLine = nl === -1 ? text : text.slice(0, nl);
    const subtitleLines = nl === -1 ? "" : text.slice(nl + 1);
    return (
      <div className="card-preview card-preview--typographic" aria-live="polite">
        <p className="preview-title">{titleLine}</p>
        {subtitleLines ? (
          <p className="preview-subtitle">{subtitleLines}</p>
        ) : null}
      </div>
    );
  }

  if (layout === "titleSubtitleBody") {
    const blocks = text.split(/\n\n+/);
    const head = blocks[0] ?? "";
    const body = blocks.slice(1).join("\n\n");
    const firstNl = head.indexOf("\n");
    const titleLine = firstNl === -1 ? head : head.slice(0, firstNl);
    const subtitleLines =
      firstNl === -1 ? "" : head.slice(firstNl + 1);
    return (
      <div className="card-preview card-preview--typographic" aria-live="polite">
        <p className="preview-title">{titleLine}</p>
        {subtitleLines ? (
          <p className="preview-subtitle">{subtitleLines}</p>
        ) : null}
        {body ? <p className="preview-body">{body}</p> : null}
      </div>
    );
  }

  return (
    <pre className="card-preview" aria-live="polite">
      {text}
    </pre>
  );
}

export function OutputCard({ title, text, previewLayout = "default" }: OutputCardProps) {
  const [copied, setCopied] = useState(false);
  const counts = countText(text);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article className="card">
      <header className="card-header">
        <h2 className="card-title">{title}</h2>
      </header>
      {renderPreview(text, previewLayout)}
      <footer className="card-footer">
        <p className="metrics">
          {counts.characters} characters · {counts.words} words · {counts.lines}{" "}
          lines
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </footer>
    </article>
  );
}
