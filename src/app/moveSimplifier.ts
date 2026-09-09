type ParsedMove = { face: string; turns: number };
type WideMoveRule = {
  face: string;
  axis: string;
  wideFace: string;
  inverseRotation: boolean;
};

const wideMoveRules: readonly WideMoveRule[] = [
  { face: 'L', axis: 'x', wideFace: 'Rw', inverseRotation: false },
  { face: 'R', axis: 'x', wideFace: 'Lw', inverseRotation: true },
  { face: 'D', axis: 'y', wideFace: 'Uw', inverseRotation: false },
  { face: 'U', axis: 'y', wideFace: 'Dw', inverseRotation: true },
  { face: 'B', axis: 'z', wideFace: 'Fw', inverseRotation: false },
  { face: 'F', axis: 'z', wideFace: 'Bw', inverseRotation: true },
];

function parseMove(token: string): ParsedMove | undefined {
  const match = /^([URFDLB]w?|[xyz])([2']?)$/.exec(token);
  if (!match) return undefined;
  return { face: match[1]!, turns: match[2] === "'" ? 3 : match[2] === '2' ? 2 : 1 };
}

function formatMove({ face, turns }: ParsedMove): string {
  switch (turns) {
    case 1:
      return face;
    case 2:
      return `${face}2`;
    default:
      return `${face}'`;
  }
}

function inverseTurns(turns: number): number {
  return (4 - turns) % 4;
}

/**
 * Absorb a same-axis regrip into an adjacent outer-face move. This is the
 * conventional fixed-frame spelling: `L x` is `Rw`, `D y` is `Uw`, etc.
 */
function toWideMove(face: ParsedMove, rotation: ParsedMove): ParsedMove | undefined {
  const rule = wideMoveRules.find(
    (candidate) => candidate.face === face.face && candidate.axis === rotation.face,
  );
  if (!rule) return undefined;
  const expectedTurns = rule.inverseRotation ? inverseTurns(face.turns) : face.turns;
  return rotation.turns === expectedTurns ? { face: rule.wideFace, turns: face.turns } : undefined;
}

/** Combine adjacent turns of the same face or whole-cube axis. */
export function simplifyMoves(value: string): string {
  const result: Array<ParsedMove | string> = [];
  const reduceTail = (): void => {
    while (true) {
      const last = result.at(-1);
      const previous = result.at(-2);
      if (!last || !previous || typeof last === 'string' || typeof previous === 'string') break;
      if (previous.face === last.face) {
        const turns = (previous.turns + last.turns) % 4;
        result.splice(-2, 2);
        if (turns !== 0) result.push({ face: previous.face, turns });
      } else {
        const wide = toWideMove(previous, last);
        if (!wide) break;
        result.splice(-2, 2, wide);
      }
    }
  };
  for (const token of value.trim().split(/\s+/)) {
    if (token === '') continue;
    const move = parseMove(token);
    result.push(move ?? token);
    if (move) reduceTail();
  }
  return result.map((entry) => (typeof entry === 'string' ? entry : formatMove(entry))).join(' ');
}
