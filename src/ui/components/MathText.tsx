import katex from 'katex';
import { Fragment, useMemo } from 'react';
import { parseRichText } from '../../engine/richtext';

export function Tex({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false, displayMode: display }), [latex, display]);
  return <span className={display ? 'tex-display' : 'tex'} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain text with *emphasis*. */
function Emphasis({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** Renders RichText: text with $inline$ and $$display$$ math. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => parseRichText(text), [text]);
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.type === 'text' ? <Emphasis key={i} text={s.value} /> : <Tex key={i} latex={s.value} display={s.display} />,
      )}
    </span>
  );
}
