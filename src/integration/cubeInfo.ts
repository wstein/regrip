import type {
  GoCubeOfflineStats,
  SmartCubeCapabilities,
  SmartCubeCubieState,
} from 'smartcube-web-bluetooth';

export function formatCapabilities(capabilities: SmartCubeCapabilities): string {
  const supported = [
    ['gyro', capabilities.gyroscope],
    ['battery', capabilities.battery],
    ['facelets', capabilities.facelets],
    ['hardware', capabilities.hardware],
    ['reset', capabilities.reset],
  ]
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const controls = capabilities.vendorCommands;
  return controls?.length
    ? `${supported.join(', ')}; controls: ${controls.join(', ')}`
    : supported.join(', ');
}

export function formatOfflineStats(stats: GoCubeOfflineStats): {
  moves: string;
  duration: string;
  solves: string;
} {
  const hours = Math.floor(stats.timeSeconds / 3600);
  const minutes = Math.floor((stats.timeSeconds % 3600) / 60);
  const seconds = stats.timeSeconds % 60;
  return {
    moves: stats.moves.toLocaleString(),
    duration: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    solves: stats.solves.toLocaleString(),
  };
}

const corners = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const edges = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

function cycles(
  permutation: number[],
  orientation: number[],
  names: string[],
  signs: string[],
): string {
  if (
    permutation.length !== names.length ||
    orientation.length !== names.length ||
    permutation.some((piece) => !Number.isInteger(piece) || piece < 0 || piece >= names.length) ||
    orientation.some((value) => !Number.isInteger(value) || value < 0 || value >= signs.length)
  ) {
    return '(unavailable)';
  }
  const visited = new Array(names.length).fill(false);
  const result: string[] = [];
  for (let start = 0; start < names.length; start += 1) {
    if (visited[start]) continue;
    const cycle: string[] = [];
    let position = start;
    while (!visited[position]) {
      visited[position] = true;
      cycle.push(`${names[permutation[position]]}${signs[orientation[position]]}`);
      position = permutation[position]!;
    }
    if (cycle.length > 1 || orientation[start] !== 0) result.push(`(${cycle.join(',')})`);
  }
  return result.join(' ');
}

function rotateLeft(value: string, amount: number): string {
  const offset = amount % value.length;
  return `${value.slice(offset)}${value.slice(0, offset)}`;
}

function inversePermutation(permutation: number[]): number[] | undefined {
  const inverse = new Array<number>(permutation.length);
  for (let slot = 0; slot < permutation.length; slot += 1) {
    const piece = permutation[slot]!;
    if (
      !Number.isInteger(piece) ||
      piece < 0 ||
      piece >= permutation.length ||
      inverse[piece] !== undefined
    ) {
      return undefined;
    }
    inverse[piece] = slot;
  }
  return inverse;
}

function supersetEngCycles(
  permutation: number[],
  orientation: number[],
  names: string[],
  orientationModulus: number,
  signs: string[],
): string | undefined {
  if (
    permutation.length !== names.length ||
    orientation.length !== names.length ||
    orientation.some(
      (value) => !Number.isInteger(value) || value < 0 || value >= orientationModulus,
    )
  ) {
    return undefined;
  }
  const destinationByPiece = inversePermutation(permutation);
  if (!destinationByPiece) return undefined;

  const visited = new Array(names.length).fill(false);
  const result: string[] = [];
  for (let start = 0; start < names.length; start += 1) {
    if (visited[start]) continue;
    const cycle: string[] = [];
    let piece = start;
    let rotation = 0;
    while (!visited[piece]) {
      visited[piece] = true;
      cycle.push(rotateLeft(names[piece]!, rotation).toLowerCase());
      const destination = destinationByPiece[piece]!;
      rotation = (rotation + orientation[destination]!) % orientationModulus;
      piece = destination;
    }
    if (cycle.length > 1 || rotation !== 0) result.push(`(${signs[rotation]}${cycle.join(',')})`);
  }
  return result.join(' ');
}

/**
 * Singmaster cubie cycle notation projected from Kociemba cubie-level
 * coordinates. A corner cycle follows piece arrows, the inverse direction of
 * Kociemba's target-slot orientation: o:1 renders `-`, and o:2 renders `+`.
 * Edge flips are self-inverse and render `+`; unmarked pieces have o:0.
 */
export function formatSingmasterCycles(state: SmartCubeCubieState): string {
  return [
    cycles(state.CP, state.CO, corners, ['', '-', '+']),
    cycles(state.EP, state.EO, edges, ['', '+']),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * CubeTwister Superset ENG 3×3 permutation cycles from Kociemba coordinates.
 * Location tokens encode each corner or edge's orientation by their letter
 * order. Smart-cube CP/CO/EP/EO data has no observable center orientation,
 * so side-part cycles such as `(++u)` are intentionally omitted.
 */
export function formatSupersetEngPermutation(state: SmartCubeCubieState): string {
  const cornerCycles = supersetEngCycles(state.CP, state.CO, corners, 3, ['', '-', '+']);
  const edgeCycles = supersetEngCycles(state.EP, state.EO, edges, 2, ['', '+']);
  if (cornerCycles === undefined || edgeCycles === undefined) return '(unavailable)';
  return [cornerCycles, edgeCycles].filter(Boolean).join(' ');
}
