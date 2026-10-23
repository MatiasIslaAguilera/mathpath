// The garden on Home: an isometric island with one plot per master's skill (learning/garden.ts).
// Pure inline SVG, colored by CSS classes so it follows light/dark mode and works offline.

import type { Plot } from '../../learning/garden';

const COLS = 9;
const TW = 40; // tile width
const TH = 20; // tile height
const DEPTH = 14; // island thickness

const tileCenter = (c: number, r: number) => ({ x: (c - r) * (TW / 2), y: (c + r) * (TH / 2) });

const diamond = (x: number, y: number, w = TW, h = TH) => `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`;

/** Stable small variety per skill (leaf shade, flower colour), so the garden doesn't look stamped. */
function variant(id: string, n: number) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

function PlantShape({ plot, x, y }: { plot: Plot; x: number; y: number }) {
  const leaf = `g-leaf-${variant(plot.id, 3)}`;
  const flower = `g-flower-${variant(plot.id + 'f', 4)}`;
  switch (plot.stage) {
    case 'soil':
    case 'grass':
      return null;
    case 'seed':
      return (
        <g>
          <ellipse cx={x} cy={y} rx={6} ry={3} className="g-mound" />
          <circle cx={x} cy={y - 1.5} r={1.4} className="g-seed" />
        </g>
      );
    case 'sprout':
      return (
        <g className="g-sway">
          <path d={`M${x} ${y} V${y - 9}`} className="g-stem" />
          <ellipse cx={x - 3.5} cy={y - 9} rx={3.6} ry={2} transform={`rotate(-25 ${x - 3.5} ${y - 9})`} className={leaf} />
          <ellipse cx={x + 3.5} cy={y - 10} rx={3.6} ry={2} transform={`rotate(25 ${x + 3.5} ${y - 10})`} className={leaf} />
        </g>
      );
    case 'sapling':
      return (
        <g className="g-sway">
          <path d={`M${x} ${y} V${y - 8}`} className="g-trunk" />
          <circle cx={x} cy={y - 12} r={7} className={leaf} />
          <circle cx={x - 2.5} cy={y - 14} r={2.4} className="g-shine" />
        </g>
      );
    case 'bud':
      return (
        <g className="g-sway">
          <path d={`M${x} ${y} V${y - 10}`} className="g-trunk" />
          <circle cx={x} cy={y - 16} r={9} className={leaf} />
          <circle cx={x - 3} cy={y - 19} r={3} className="g-shine" />
          <circle cx={x + 4} cy={y - 19} r={1.8} className={`g-bud ${flower}`} />
          <circle cx={x - 4} cy={y - 13} r={1.8} className={`g-bud ${flower}`} />
          <circle cx={x + 2} cy={y - 10} r={1.8} className={`g-bud ${flower}`} />
        </g>
      );
    case 'bloom':
      return (
        <g className="g-sway">
          <path d={`M${x} ${y} V${y - 12}`} className="g-trunk thick" />
          <circle cx={x - 5} cy={y - 18} r={7.5} className={plot.faded ? 'g-faded' : leaf} />
          <circle cx={x + 5} cy={y - 18} r={7.5} className={plot.faded ? 'g-faded' : leaf} />
          <circle cx={x} cy={y - 25} r={9} className={plot.faded ? 'g-faded' : leaf} />
          <circle cx={x - 3} cy={y - 28} r={3} className="g-shine" />
          {!plot.faded &&
            [
              [-7, -19],
              [6, -22],
              [0, -29],
              [-2, -15],
              [8, -15],
            ].map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r={2} className={flower} />)}
        </g>
      );
  }
}

function Droplet({ x, y }: { x: number; y: number }) {
  return <path className="g-drop" d={`M${x} ${y - 7} C${x + 4} ${y - 1} ${x + 3.5} ${y + 2} ${x} ${y + 2} C${x - 3.5} ${y + 2} ${x - 4} ${y - 1} ${x} ${y - 7} Z`} />;
}

const plantTop: Record<Plot['stage'], number> = { soil: 0, grass: 0, seed: 4, sprout: 13, sapling: 20, bud: 26, bloom: 35 };

export function Garden({ plots }: { plots: Plot[] }) {
  const rows = Math.ceil(plots.length / COLS);
  const cells: { c: number; r: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) cells.push({ c, r });
  // The earliest skills (tree order) take the front plots, so the garden fills from front to back.
  const frontFirst = [...cells].sort((a, b) => b.c + b.r - (a.c + a.r) || Math.abs(a.c - a.r - 2) - Math.abs(b.c - b.r - 2));
  const placed = plots.map((plot, i) => ({ plot, ...frontFirst[i] }));
  // Paint back to front.
  const order = [...placed].sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);

  const left = tileCenter(0, rows - 1);
  const right = tileCenter(COLS - 1, 0);
  const bottom = tileCenter(COLS - 1, rows - 1);
  const top = tileCenter(0, 0);
  const L = { x: left.x - TW / 2, y: left.y };
  const R = { x: right.x + TW / 2, y: right.y };
  const B = { x: bottom.x, y: bottom.y + TH / 2 };
  const T = { x: top.x, y: top.y - TH / 2 };

  // Room on the left for the cat (positioned over it by Home's CSS).
  const minX = L.x - 96;
  const maxX = R.x + 8;
  const minY = T.y - 36;
  const maxY = B.y + DEPTH + 10;

  return (
    <svg className="garden-svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">
      <ellipse cx={(L.x + R.x) / 2} cy={B.y + DEPTH + 2} rx={(R.x - L.x) / 2.1} ry={9} className="g-shadow" />
      <polygon points={`${L.x},${L.y} ${B.x},${B.y} ${B.x},${B.y + DEPTH} ${L.x},${L.y + DEPTH}`} className="g-side-l" />
      <polygon points={`${B.x},${B.y} ${R.x},${R.y} ${R.x},${R.y + DEPTH} ${B.x},${B.y + DEPTH}`} className="g-side-r" />
      <polygon points={`${T.x},${T.y} ${R.x},${R.y} ${B.x},${B.y} ${L.x},${L.y}`} className="g-top" />
      {order.map(({ plot, c, r }) => {
        const { x, y } = tileCenter(c, r);
        return (
          <g key={plot.id} data-plot={plot.id} data-stage={plot.stage}>
            <title>{plot.title}</title>
            <polygon points={diamond(x, y, TW - 3, TH - 1.5)} className={plot.stage === 'soil' ? 'g-tile soil' : (c + r) % 2 ? 'g-tile' : 'g-tile alt'} />
            <PlantShape plot={plot} x={x} y={y + 2} />
            {plot.thirsty && <Droplet x={x + 8} y={y - plantTop[plot.stage] - 2} />}
          </g>
        );
      })}
    </svg>
  );
}
