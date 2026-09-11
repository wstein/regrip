type ParsedMove = { face: string; turns: number };
type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
type Orientation = Readonly<Record<Face, Face>>;

const faces: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const identity: Orientation = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };

// `orientation[face]` is the solver-frame face produced by conjugating that
// body-frame face with the rotations accumulated to its left. For example,
// x U x' = F.
const quarterRotations: Readonly<Record<'x' | 'y' | 'z', Orientation>> = {
  x: { U: 'F', R: 'R', F: 'D', D: 'B', L: 'L', B: 'U' },
  y: { U: 'U', R: 'B', F: 'R', D: 'D', L: 'F', B: 'L' },
  z: { U: 'L', R: 'U', F: 'F', D: 'R', L: 'D', B: 'B' },
};

const wideMoveRules: readonly {
  face: string;
  axis: string;
  wideFace: string;
  inverseRotation: boolean;
}[] = [
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

function compose(left: Orientation, right: Orientation): Orientation {
  return Object.fromEntries(faces.map((face) => [face, left[right[face]]])) as Orientation;
}

function rotationOrientation(axis: 'x' | 'y' | 'z', turns: number): Orientation {
  let result = identity;
  for (let index = 0; index < turns; index += 1) result = compose(result, quarterRotations[axis]);
  return result;
}

function orientationKey(orientation: Orientation): string {
  return faces.map((face) => orientation[face]).join('');
}

const rotationTokens: readonly ParsedMove[] = [
  { face: 'x', turns: 1 },
  { face: 'x', turns: 3 },
  { face: 'x', turns: 2 },
  { face: 'y', turns: 1 },
  { face: 'y', turns: 3 },
  { face: 'y', turns: 2 },
  { face: 'z', turns: 1 },
  { face: 'z', turns: 3 },
  { face: 'z', turns: 2 },
];

/** The shortest conventional x/y/z spelling for every one of 24 cube poses. */
const canonicalRotations: ReadonlyMap<string, readonly ParsedMove[]> = (() => {
  const paths = new Map<string, readonly ParsedMove[]>([[orientationKey(identity), []]]);
  const pending: Array<{ orientation: Orientation; path: readonly ParsedMove[] }> = [
    { orientation: identity, path: [] },
  ];
  while (pending.length > 0) {
    const current = pending.shift()!;
    for (const token of rotationTokens) {
      const next = compose(
        current.orientation,
        rotationOrientation(token.face as 'x' | 'y' | 'z', token.turns),
      );
      const key = orientationKey(next);
      if (paths.has(key)) continue;
      const path = [...current.path, token];
      paths.set(key, path);
      pending.push({ orientation: next, path });
    }
  }
  return paths;
})();

function isFaceMove(move: ParsedMove): move is ParsedMove & { face: Face | `${Face}w` } {
  return /^[URFDLB]w?$/.test(move.face);
}

function reframe(move: ParsedMove, orientation: Orientation): ParsedMove {
  const face = move.face[0] as Face;
  const transformedFace = orientation[face];
  return { ...move, face: move.face.endsWith('w') ? `${transformedFace}w` : transformedFace };
}

/** Absorb a same-axis regrip into an adjacent outer-face move. */
function toWideMove(face: ParsedMove, rotation: ParsedMove): ParsedMove | undefined {
  const rule = wideMoveRules.find(
    (candidate) => candidate.face === face.face && candidate.axis === rotation.face,
  );
  if (!rule) return undefined;
  const expectedTurns = rule.inverseRotation ? inverseTurns(face.turns) : face.turns;
  return rotation.turns === expectedTurns ? { face: rule.wideFace, turns: face.turns } : undefined;
}

/**
 * Normalize rotations through each following outer/wide move, then emit one
 * shortest suffix for the remaining cube orientation. Unknown notation stays
 * an opaque barrier: its surrounding rotations are never reordered.
 */
export function simplifyMoves(value: string): string {
  const result: Array<ParsedMove | string> = [];
  let orientation = identity;
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
  const append = (move: ParsedMove | string): void => {
    result.push(move);
    if (typeof move !== 'string') reduceTail();
  };
  const flushOrientation = (): void => {
    canonicalRotations.get(orientationKey(orientation))!.forEach(append);
    orientation = identity;
  };

  for (const token of value.trim().split(/\s+/)) {
    if (token === '') continue;
    const move = parseMove(token);
    if (!move) {
      flushOrientation();
      append(token);
    } else if (move.face === 'x' || move.face === 'y' || move.face === 'z') {
      orientation = compose(orientation, rotationOrientation(move.face, move.turns));
    } else if (isFaceMove(move)) {
      append(reframe(move, orientation));
    }
  }
  flushOrientation();
  return result.map((entry) => (typeof entry === 'string' ? entry : formatMove(entry))).join(' ');
}
