type ParsedMove = { face: string; turns: number };

function parseMove(token: string): ParsedMove | undefined {
  const match = /^([URFDLB]w?|[xyz])([2']?)$/.exec(token);
  if (!match) return undefined;
  return { face: match[1]!, turns: match[2] === "'" ? 3 : match[2] === '2' ? 2 : 1 };
}

function formatMove({ face, turns }: ParsedMove): string {
  return turns === 1 ? face : turns === 2 ? `${face}2` : `${face}'`;
}

function inverseTurns(turns: number): number {
  return (4 - turns) % 4;
}

/**
 * Absorb a same-axis regrip into an adjacent outer-face move. This is the
 * conventional fixed-frame spelling: `L x` is `Rw`, `D y` is `Uw`, etc.
 */
function toWideMove(face: ParsedMove, rotation: ParsedMove): ParsedMove | undefined {
  const sameTurn = face.turns === rotation.turns;
  const inverseTurn = inverseTurns(face.turns) === rotation.turns;
  if (face.face === 'L' && rotation.face === 'x' && sameTurn)
    return { face: 'Rw', turns: face.turns };
  if (face.face === 'R' && rotation.face === 'x' && inverseTurn)
    return { face: 'Lw', turns: face.turns };
  if (face.face === 'D' && rotation.face === 'y' && sameTurn)
    return { face: 'Uw', turns: face.turns };
  if (face.face === 'U' && rotation.face === 'y' && inverseTurn)
    return { face: 'Dw', turns: face.turns };
  if (face.face === 'B' && rotation.face === 'z' && sameTurn)
    return { face: 'Fw', turns: face.turns };
  if (face.face === 'F' && rotation.face === 'z' && inverseTurn)
    return { face: 'Bw', turns: face.turns };
  return undefined;
}

/** Combine adjacent turns of the same face or whole-cube axis. */
export function simplifyMoves(value: string): string {
  const result: Array<ParsedMove | string> = [];
  const reduceTail = (): void => {
    let reduced = true;
    while (reduced) {
      reduced = false;
      const last = result.at(-1);
      const previous = result.at(-2);
      if (!last || !previous || typeof last === 'string' || typeof previous === 'string') return;
      if (previous.face === last.face) {
        const turns = (previous.turns + last.turns) % 4;
        result.splice(-2, 2);
        if (turns !== 0) result.push({ face: previous.face, turns });
        reduced = true;
        continue;
      }
      const wide = toWideMove(previous, last);
      if (wide) {
        result.splice(-2, 2, wide);
        reduced = true;
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
