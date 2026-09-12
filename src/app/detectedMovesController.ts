import {
  formatDetectedMoves,
  parseDetectedMoves,
  simplifyMovesModuloRotations,
  simplifySseMoves,
  type DetectedMoveNotation,
} from './moveSimplifier';

type DetectedMovesView = {
  read(): string;
  write(value: string): void;
  setCount(value: number): void;
  setReadOnly(readOnly: boolean): void;
  setSimplifyEnabled(enabled: boolean): void;
  setNotation(notation: DetectedMoveNotation): void;
};

export function countDetectedMoves(value: string): number {
  const trimmed = value.trim();
  return trimmed === ''
    ? 0
    : trimmed.split(/\s+/).filter((token) => !/^[·•/|]$/.test(token)).length;
}

/** Own the editable canonical move stream and its alternate notation views. */
export function createDetectedMovesController(view: DetectedMovesView) {
  let notation: DetectedMoveNotation = 'wca';
  let canonical = '';
  let rawQtm: string[] = [];

  const syncCanonicalEdit = (): string => {
    if (notation !== 'raw-qtm') canonical = parseDetectedMoves(view.read(), notation);
    return canonical;
  };

  const render = (): void => {
    const raw = rawQtm.join(' ');
    const text = notation === 'raw-qtm' ? raw : formatDetectedMoves(canonical, notation);
    view.write(text);
    view.setCount(countDetectedMoves(notation === 'raw-qtm' ? raw : canonical));
    view.setReadOnly(notation === 'raw-qtm');
    view.setSimplifyEnabled(notation !== 'raw-qtm');
    view.setNotation(notation);
  };

  return {
    append(move: string, rawMove?: string): void {
      const current = syncCanonicalEdit();
      canonical = current ? `${current} ${move}` : move;
      if (rawMove) rawQtm.push(rawMove);
      render();
    },
    clear(): void {
      canonical = '';
      rawQtm = [];
      render();
    },
    replace(nextCanonical: string, nextRawQtm: readonly string[] = []): void {
      canonical = nextCanonical;
      rawQtm = [...nextRawQtm];
      render();
    },
    setNotation(nextNotation: DetectedMoveNotation): void {
      syncCanonicalEdit();
      notation = nextNotation;
      render();
    },
    edited(): void {
      syncCanonicalEdit();
      view.setCount(countDetectedMoves(view.read()));
    },
    simplify(): boolean {
      if (notation === 'raw-qtm') return false;
      const simplified = simplifyMovesModuloRotations(syncCanonicalEdit());
      canonical =
        notation === 'sse' ? parseDetectedMoves(simplifySseMoves(simplified), 'sse') : simplified;
      render();
      return true;
    },
    text(): string {
      return view.read();
    },
  };
}
