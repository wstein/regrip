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
      cycle.push(`${names[permutation[position]]!}${signs[orientation[position]]!}`);
      position = permutation[position]!;
    }
    if (cycle.length > 1 || orientation[start] !== 0) result.push(`(${cycle.join(',')})`);
  }
  return result.join(' ') || '(solved)';
}

/** Human-readable Singmaster cycle notation for a cubie's current state. */
export function formatCubieState(state: SmartCubeCubieState): string {
  return `Corners ${cycles(state.CP, state.CO, corners, ['', '+', '-'])} | Edges ${cycles(state.EP, state.EO, edges, ['', '+'])}`;
}
