import { describe, expect, it } from 'vitest';

import { countDetectedMoves, createDetectedMovesController } from './detectedMovesController';
import type { DetectedMoveNotation } from './moveSimplifier';

function fixture() {
  const state = {
    text: '',
    count: 0,
    readOnly: false,
    simplifyEnabled: true,
    notation: 'wca' as DetectedMoveNotation,
  };
  const controller = createDetectedMovesController({
    read: () => state.text,
    write: (text) => {
      state.text = text;
    },
    setCount: (count) => {
      state.count = count;
    },
    setReadOnly: (readOnly) => {
      state.readOnly = readOnly;
    },
    setSimplifyEnabled: (enabled) => {
      state.simplifyEnabled = enabled;
    },
    setNotation: (notation) => {
      state.notation = notation;
    },
  });
  return { controller, state };
}

describe('detected moves controller', () => {
  it('counts move tokens without counting visual separators', () => {
    expect(countDetectedMoves("  R  U'\ny  x2  ")).toBe(4);
    expect(countDetectedMoves('R · U | F')).toBe(3);
    expect(countDetectedMoves('   ')).toBe(0);
  });

  it('round-trips user edits while switching notation views', () => {
    const { controller, state } = fixture();
    controller.replace("Rw U Lw'");
    controller.setNotation('sign');
    expect(state.text).toBe("r U l'");

    state.text = "r U l' 2L";
    controller.edited();
    controller.setNotation('wca');
    expect(state.text).toBe("Rw U Lw' M");
    expect(state.count).toBe(4);
  });

  it('keeps raw QTM immutable while canonical moves remain editable', () => {
    const { controller, state } = fixture();
    controller.append('R', 'R');
    controller.append('x');
    controller.append('U', "D'");
    controller.setNotation('raw-qtm');

    expect(state.text).toBe("R D'");
    expect(state.readOnly).toBe(true);
    expect(state.simplifyEnabled).toBe(false);
    expect(controller.simplify()).toBe(false);

    controller.setNotation('wca');
    expect(state.text).toBe('R x U');
  });

  it('simplifies only on explicit request using the selected notation rules', () => {
    const { controller, state } = fixture();
    controller.replace("U U D' D'");
    expect(state.text).toBe("U U D' D'");
    controller.setNotation('sse');

    expect(controller.simplify()).toBe(true);
    expect(state.text).toBe('MD2');
    controller.clear();
    expect(state).toMatchObject({ text: '', count: 0 });
  });
});
