import {
  formatDetectedMoves,
  parseDetectedMoves,
  simplifyMovesModuloRotations,
  type DetectedMoveNotation,
  validateDetectedMoves,
} from './moveSimplifier';

type DetectedMovesView = {
  read(): string;
  write(value: string): void;
  setCount(value: number): void;
  setReadOnly(readOnly: boolean): void;
  setSimplifyEnabled(enabled: boolean): void;
  setNotation(notation: DetectedMoveNotation): void;
  setValidationError(error: string | undefined): void;
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

  const syncCanonicalEdit = (): string | undefined => {
    if (notation === 'raw-qtm') return canonical;
    const input = view.read();
    const error = validateDetectedMoves(input, notation);
    view.setValidationError(error);
    if (error) return undefined;
    canonical = parseDetectedMoves(input, notation);
    return canonical;
  };

  const render = (): void => {
    const raw = rawQtm.join(' ');
    const text = notation === 'raw-qtm' ? raw : formatDetectedMoves(canonical, notation);
    view.write(text);
    view.setCount(countDetectedMoves(notation === 'raw-qtm' ? raw : canonical));
    view.setReadOnly(notation === 'raw-qtm');
    view.setSimplifyEnabled(notation !== 'raw-qtm');
    view.setValidationError(undefined);
    view.setNotation(notation);
  };

  return {
    append(move: string, rawMove?: string): void {
      const current = syncCanonicalEdit() ?? canonical;
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
      if (syncCanonicalEdit() === undefined) return;
      notation = nextNotation;
      render();
    },
    edited(): void {
      const valid = syncCanonicalEdit() !== undefined;
      view.setCount(countDetectedMoves(view.read()));
      view.setSimplifyEnabled(notation !== 'raw-qtm' && valid);
    },
    simplify(): boolean {
      if (notation === 'raw-qtm') return false;
      const current = syncCanonicalEdit();
      if (current === undefined) return false;
      canonical = simplifyMovesModuloRotations(current);
      render();
      return true;
    },
    text(): string {
      return view.read();
    },
  };
}
