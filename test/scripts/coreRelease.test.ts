import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const script = join(root, 'scripts/check-core-release-tag.mjs');
const packageJson = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8')) as {
  version: string;
};
const expectedTag = `core-v${packageJson.version}`;

describe('core release tag', () => {
  it('accepts the package-specific version tag', () => {
    expect(() => execFileSync(process.execPath, [script, expectedTag])).not.toThrow();
  });

  it('rejects a tag that does not match the package version', () => {
    const result = spawnSync(process.execPath, [script, 'core-v999.0.0'], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`does not match packages/core/package.json (${expectedTag})`);
  });
});
