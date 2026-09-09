type ParsedMove = { face: string; turns: number };

function parseMove(token: string): ParsedMove | undefined {
  const match = /^([URFDLBxyz])([2']?)$/.exec(token);
  if (!match) return undefined;
  return { face: match[1]!, turns: match[2] === "'" ? 3 : match[2] === '2' ? 2 : 1 };
}

function formatMove({ face, turns }: ParsedMove): string {
  return turns === 1 ? face : turns === 2 ? `${face}2` : `${face}'`;
}

/** Combine adjacent turns of the same face or whole-cube axis. */
export function simplifyMoves(value: string): string {
  const result: Array<ParsedMove | string> = [];
  for (const token of value.trim().split(/\s+/)) {
    if (token === '') continue;
    const move = parseMove(token);
    const previous = result.at(-1);
    if (move && previous && typeof previous !== 'string' && previous.face === move.face) {
      const turns = (previous.turns + move.turns) % 4;
      if (turns === 0) result.pop();
      else previous.turns = turns;
    } else result.push(move ?? token);
  }
  return result.map((entry) => (typeof entry === 'string' ? entry : formatMove(entry))).join(' ');
}
