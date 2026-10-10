import { Fragment } from "react";

// Renders the small subset of markdown models commonly use (paragraphs, "-"/"*"/"1." lists,
// **bold**, ### headings) as React elements. No HTML is ever injected, so model output
// cannot run scripts in the page.

// [1] style citation markers become small links to the cited source.
function withCitations(text, keyBase, sources) {
  if (!sources?.length) return text;
  const byN = Object.fromEntries(sources.map((s) => [s.n, s]));
  return text.split(/(\[\d{1,2}\])/g).map((piece, i) => {
    const m = piece.match(/^\[(\d{1,2})\]$/);
    const src = m && byN[Number(m[1])];
    return src ? (
      <sup key={`${keyBase}-c${i}`} className="cp-cite">
        <a href={src.url} target="_blank" rel="noreferrer" title={`${src.title} (${src.source})`}>{m[1]}</a>
      </sup>
    ) : (
      <Fragment key={`${keyBase}-c${i}`}>{piece}</Fragment>
    );
  });
}

function inline(text, keyBase, sources) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`}>{withCitations(part.slice(2, -2), `${keyBase}-${i}`, sources)}</strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{withCitations(part, `${keyBase}-${i}`, sources)}</Fragment>
    )
  );
}

export default function RichText({ text, sources }) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { type: "list", ordered, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
      return;
    }
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)/);
    blocks.push({ type: heading ? "h" : "p", text: heading ? heading[1] : line, idx });
  });
  flush();

  return blocks.map((b, i) => {
    if (b.type === "list") {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag key={i} className="cp-list">
          {b.items.map((item, j) => (
            <li key={j}>{inline(item, `${i}-${j}`, sources)}</li>
          ))}
        </Tag>
      );
    }
    if (b.type === "h") return <p key={i} className="cp-heading">{inline(b.text, i, sources)}</p>;
    return <p key={i}>{inline(b.text, i, sources)}</p>;
  });
}
