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

export function formatCubieState(state: SmartCubeCubieState): string {
  return `CP ${state.CP.join(',')} | CO ${state.CO.join(',')} | EP ${state.EP.join(',')} | EO ${state.EO.join(',')}`;
}
