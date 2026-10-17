import type { AnswerSpec, Figure } from '../../engine/types';
import { MathText, Tex } from './MathText';

/** The correct answer, however it's shaped (a value, a chosen option, or several options). */
export function AnswerDisplay({ spec, display = true }: { spec: AnswerSpec; display?: boolean }) {
  switch (spec.kind) {
    case 'choice':
      return <MathText text={spec.options.find((o) => o.id === spec.correct)?.label ?? ''} />;
    case 'multi':
      return (
        <ul className="answer-list">
          {spec.options
            .filter((o) => spec.correct.includes(o.id))
            .map((o) => (
              <li key={o.id}>
                <MathText text={o.label} />
              </li>
            ))}
        </ul>
      );
    default:
      return <Tex latex={spec.display} display={display} />;
  }
}

/** A generated diagram or a data table shown with the prompt. */
export function FigureView({ figure }: { figure: Figure }) {
  if (figure.kind === 'svg') {
    // The SVG comes from our own generators (engine/figures.ts), never from user input.
    return <div className="figure" role="img" aria-label={figure.alt} dangerouslySetInnerHTML={{ __html: figure.svg }} />;
  }
  return (
    <div className="figure table-wrap">
      <table className="data-table">
        <caption>
          <MathText text={figure.caption} />
        </caption>
        <thead>
          <tr>
            {figure.headers.map((h, i) => (
              <th key={i} scope="col">
                <MathText text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {figure.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) =>
                c === 0 ? (
                  <th key={c} scope="row">
                    <MathText text={cell} />
                  </th>
                ) : (
                  <td key={c}>
                    <MathText text={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
