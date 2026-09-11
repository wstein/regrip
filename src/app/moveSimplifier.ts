type ParsedMove = { face: string; turns: number };
type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
type Slice = 'M' | 'E' | 'S';
type Orientation = Readonly<Record<Face, Face>>;

export type DetectedMoveNotation = 'wca' | 'twizzle' | 'sse';

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
  const match = /^([URFDLB]w?|[MES]|[xyz])([2']?)$/.exec(token);
  if (!match) return undefined;
  return { face: match[1], turns: match[2] === "'" ? 3 : match[2] === '2' ? 2 : 1 };
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

function suffixForTurns(turns: number): string {
  return turns === 1 ? '' : turns === 2 ? '2' : "'";
}

function isOuterFaceMove(move: ParsedMove): move is ParsedMove & { face: Face } {
  return /^[URFDLB]$/.test(move.face);
}

const opposingFaces: Readonly<Record<Face, Face>> = {
  U: 'D',
  R: 'L',
  F: 'B',
  D: 'U',
  L: 'R',
  B: 'F',
};

function sseOpposingSlice(
  first: ParsedMove | undefined,
  second: ParsedMove | undefined,
): string | undefined {
  if (!first || !second || !isOuterFaceMove(first) || !isOuterFaceMove(second)) return undefined;
  if (opposingFaces[first.face] !== second.face || inverseTurns(first.turns) !== second.turns) {
    return undefined;
  }
  return `S${first.face}${suffixForTurns(first.turns)}`;
}

function appendSseMove(result: string[], token: string): void {
  const parsed = /^([A-Z]+)([2']?)$/.exec(token);
  const previous = result.at(-1);
  const prior = previous && /^([A-Z]+)([2']?)$/.exec(previous);
  if (!parsed || !prior || parsed[1] !== prior[1]) {
    result.push(token);
    return;
  }
  const turns = (turnsFromSuffix(prior[2] ?? '') + turnsFromSuffix(parsed[2] ?? '')) % 4;
  result.pop();
  if (turns !== 0) result.push(`${parsed[1]}${suffixForTurns(turns)}`);
}

function formatSseMove(move: ParsedMove): string {
  const suffix = suffixForTurns(move.turns);
  if (move.face === 'x') return `CR${suffix}`;
  if (move.face === 'y') return `CU${suffix}`;
  if (move.face === 'z') return `CF${suffix}`;
  if (move.face.endsWith('w')) return `T${move.face[0]}${suffix}`;
  if (isSliceMove(move)) return `${sseMiddleLayer[move.face]}${suffix}`;
  return `${move.face}${suffix}`;
}

/** Render the live detected stream in SSE without changing its QTM sequence. */
export function formatSseMoves(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const move = parseMove(token);
      return move ? formatSseMove(move) : token;
    })
    .join(' ');
}

/** Apply optional SSE-only pair and power reductions after an explicit simplify request. */
export function simplifySseMoves(value: string): string {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({ token, move: parseMove(token) }));
  const result: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index]!;
    const paired = sseOpposingSlice(current.move, tokens[index + 1]?.move);
    if (paired) {
      appendSseMove(result, paired);
      index += 1;
    } else if (current.move) {
      appendSseMove(result, formatSseMove(current.move));
    } else {
      result.push(current.token);
    }
  }
  return result.join(' ');
}

function formatTwizzleMoves(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const move = parseMove(token);
      if (!move) return token;
      const suffix = suffixForTurns(move.turns);
      if (move.face === 'x') return `Rv${suffix}`;
      if (move.face === 'y') return `Uv${suffix}`;
      if (move.face === 'z') return `Fv${suffix}`;
      if (move.face.endsWith('w')) return `${move.face[0]!.toLowerCase()}${suffix}`;
      if (isSliceMove(move)) return `${twizzleMiddleLayer[move.face]}${suffix}`;
      return token;
    })
    .join(' ');
}

const twizzleMiddleLayer: Readonly<Record<Slice, string>> = { M: '2L', E: '2D', S: '2F' };

function turnsFromSuffix(suffix: string): number {
  return suffix === "'" ? 3 : suffix === '2' ? 2 : 1;
}

function composeTwizzleMove(base: ParsedMove, suffix: string): string {
  return formatMove({ ...base, turns: (base.turns * turnsFromSuffix(suffix)) % 4 });
}

function parseSseMove(token: string): string[] | undefined {
  const match = /^([CTMS])([URFDLB])([2']?)$/.exec(token);
  if (!match) return undefined;
  const [, family, face, modifier] = match;
  const suffix = modifier ?? '';
  switch (family) {
    case 'C': {
      const rotation = {
        R: { face: 'x', turns: 1 },
        L: { face: 'x', turns: 3 },
        U: { face: 'y', turns: 1 },
        D: { face: 'y', turns: 3 },
        F: { face: 'z', turns: 1 },
        B: { face: 'z', turns: 3 },
      }[face!];
      if (!rotation) return undefined;
      return [composeTwizzleMove(rotation, suffix)];
    }
    case 'T':
      return [`${face}w${suffix}`];
    case 'M': {
      const slice = {
        L: { face: 'M', turns: 1 },
        R: { face: 'M', turns: 3 },
        D: { face: 'E', turns: 1 },
        U: { face: 'E', turns: 3 },
        F: { face: 'S', turns: 1 },
        B: { face: 'S', turns: 3 },
      }[face!];
      if (!slice) return undefined;
      return [composeTwizzleMove(slice, suffix)];
    }
    case 'S': {
      const opposite = opposingFaces[face as Face];
      if (!opposite) return undefined;
      const turns = turnsFromSuffix(suffix);
      return [
        `${face}${suffixForTurns(turns)}`,
        `${opposite}${suffixForTurns(inverseTurns(turns))}`,
      ];
    }
    default:
      return undefined;
  }
}

function parseTwizzleMove(token: string): string | undefined {
  const rotation = /^([URFDLB])v([2']?)$/.exec(token);
  if (rotation) {
    const base = {
      R: { face: 'x', turns: 1 },
      L: { face: 'x', turns: 3 },
      U: { face: 'y', turns: 1 },
      D: { face: 'y', turns: 3 },
      F: { face: 'z', turns: 1 },
      B: { face: 'z', turns: 3 },
    }[rotation[1]!];
    return base ? composeTwizzleMove(base, rotation[2] ?? '') : undefined;
  }
  const middle = /^2([URFDLB])([2']?)$/.exec(token);
  if (middle) {
    const base = {
      L: { face: 'M', turns: 1 },
      R: { face: 'M', turns: 3 },
      D: { face: 'E', turns: 1 },
      U: { face: 'E', turns: 3 },
      F: { face: 'S', turns: 1 },
      B: { face: 'S', turns: 3 },
    }[middle[1]!];
    return base ? composeTwizzleMove(base, middle[2] ?? '') : undefined;
  }
  const wide = /^([urfdlb])([2']?)$/.exec(token);
  return wide ? `${wide[1]!.toUpperCase()}w${wide[2] ?? ''}` : undefined;
}

/** Render Regrip's canonical detected-move stream in a selected editor notation. */
export function formatDetectedMoves(value: string, notation: DetectedMoveNotation): string {
  switch (notation) {
    case 'wca':
      return value.trim();
    case 'twizzle':
      return formatTwizzleMoves(value);
    case 'sse':
      return formatSseMoves(value);
  }
}

/** Convert an editable WCA, Twizzle, or SSE sequence back to Regrip's WCA stream. */
export function parseDetectedMoves(value: string, notation: DetectedMoveNotation): string {
  const result: string[] = [];
  for (const token of value.trim().split(/\s+/)) {
    if (token === '') continue;
    if (notation === 'sse') {
      const expanded = parseSseMove(token);
      if (expanded) {
        result.push(...expanded);
        continue;
      }
    }
    if (notation === 'twizzle') {
      const canonical = parseTwizzleMove(token);
      if (canonical) {
        result.push(canonical);
        continue;
      }
    }
    result.push(token);
  }
  return result.join(' ');
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

function isSliceMove(move: ParsedMove): move is ParsedMove & { face: Slice } {
  return /^[MES]$/.test(move.face);
}

const sliceReferenceFace: Readonly<Record<Slice, Face>> = { M: 'L', E: 'D', S: 'F' };
const sseMiddleLayer: Readonly<Record<Slice, string>> = { M: 'ML', E: 'MD', S: 'MF' };

function sliceForReferenceFace(face: Face): { slice: Slice; inverse: boolean } {
  switch (face) {
    case 'L':
      return { slice: 'M', inverse: false };
    case 'R':
      return { slice: 'M', inverse: true };
    case 'D':
      return { slice: 'E', inverse: false };
    case 'U':
      return { slice: 'E', inverse: true };
    case 'F':
      return { slice: 'S', inverse: false };
    case 'B':
      return { slice: 'S', inverse: true };
  }
}

function reframe(move: ParsedMove, orientation: Orientation): ParsedMove {
  if (isSliceMove(move)) {
    const referenceFace = orientation[sliceReferenceFace[move.face]];
    const mapped = sliceForReferenceFace(referenceFace);
    return { face: mapped.slice, turns: mapped.inverse ? inverseTurns(move.turns) : move.turns };
  }
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
    } else if (isFaceMove(move) || isSliceMove(move)) {
      append(reframe(move, orientation));
    }
  }
  flushOrientation();
  return result.map((entry) => (typeof entry === 'string' ? entry : formatMove(entry))).join(' ');
}
