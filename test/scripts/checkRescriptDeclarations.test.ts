import { describe, expect, it } from 'vitest';

import { missingDeclarationStub } from '../../scripts/check-rescript-declarations.mjs';

describe('ReScript declaration stubs', () => {
  it('suggests a constant for a non-function value', () => {
    expect(missingDeclarationStub({ name: 'solvedFacelets', arity: undefined })).toBe(
      'export const solvedFacelets: unknown;',
    );
  });

  it('preserves a ReScript function arity in the TypeScript placeholder', () => {
    expect(missingDeclarationStub({ name: 'toStickers', arity: 1 })).toBe(
      'export function toStickers(arg1: unknown): unknown;',
    );
  });

  it('suggests a zero-argument function for a ReScript unit function', () => {
    expect(missingDeclarationStub({ name: 'reset', arity: 0 })).toBe(
      'export function reset(): unknown;',
    );
  });
});
