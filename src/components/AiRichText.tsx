"use client";

import { Fragment, type ReactNode } from "react";

/** Single-asterisk emphasis: *word* — avoids matching ** */
function renderItalicAndPlain(segment: string): ReactNode[] {
  const bits = segment.split(/(\*[^*]+\*)/g);
  return bits.map((bit, i) => {
    const m = bit.match(/^\*([^*]+)\*$/);
    if (m) {
      return (
        <em key={i} className="italic text-[#ececec]">
          {m[1]}
        </em>
      );
    }
    return <Fragment key={i}>{bit}</Fragment>;
  });
}

/**
 * Renders common Gemini markdown in prose: **bold**, *italic*.
 * Strips ATX # headers at line starts; preserves newlines.
 */
export function AiRichText({ text, className = "" }: { text: string; className?: string }) {
  const normalized = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/__([^_]+)__/g, "**$1**");
  const parts = normalized.split(/\*\*/);

  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        const inner = renderItalicAndPlain(part);
        if (i % 2 === 1) {
          return (
            <strong key={i} className="font-semibold text-[#fafafa]">
              {inner}
            </strong>
          );
        }
        return <Fragment key={i}>{inner}</Fragment>;
      })}
    </span>
  );
}
