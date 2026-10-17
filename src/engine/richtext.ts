// Split RichText into plain-text and math segments.
//   $...$  inline math    $$...$$ display math    \$ a literal dollar sign (in text or math)

export type Segment = { type: 'text'; value: string } | { type: 'math'; value: string; display: boolean };

export function parseRichText(src: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let mode: 'text' | 'inline' | 'display' = 'text';
  const flush = () => {
    if (mode === 'text') {
      if (buf) out.push({ type: 'text', value: buf });
    } else {
      out.push({ type: 'math', value: buf, display: mode === 'display' });
    }
    buf = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\' && src[i + 1] === '$') {
      buf += mode === 'text' ? '$' : '\\$';
      i++;
    } else if (ch === '$') {
      const isDouble = src[i + 1] === '$';
      if (mode === 'text') {
        flush();
        mode = isDouble ? 'display' : 'inline';
      } else {
        flush();
        mode = 'text';
      }
      if (isDouble) i++;
    } else {
      buf += ch;
    }
  }
  if (mode !== 'text') throw new Error(`Unclosed math in rich text: ${src}`);
  flush();
  return out;
}
