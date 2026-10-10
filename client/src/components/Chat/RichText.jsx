import { Fragment } from "react";

// Renders the small subset of markdown models commonly use (paragraphs, "-"/"*"/"1." lists,
// **bold**, ### headings) as React elements. No HTML is ever injected, so model output
// cannot run scripts in the page.
function inline(text, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong> : <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>
  );
}

export default function RichText({ text }) {
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
            <li key={j}>{inline(item, `${i}-${j}`)}</li>
          ))}
        </Tag>
      );
    }
    if (b.type === "h") return <p key={i} className="cp-heading">{inline(b.text, i)}</p>;
    return <p key={i}>{inline(b.text, i)}</p>;
  });
}
