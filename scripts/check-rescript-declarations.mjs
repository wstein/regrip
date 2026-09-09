import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function resiFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return resiFiles(path);
    return entry.name.endsWith('.resi') ? [path] : [];
  });
}

const failures = [];
for (const resiPath of resiFiles(join(process.cwd(), 'src'))) {
  const declarationPath = resiPath.replace(/\.resi$/, '.res.d.mts');
  const resi = readFileSync(resiPath, 'utf8');
  let declaration = '';
  try {
    declaration = readFileSync(declarationPath, 'utf8');
  } catch {
    failures.push(`${resiPath}: missing ${declarationPath}`);
    continue;
  }
  const values = [...resi.matchAll(/^let\s+([A-Za-z_$][\w$]*)\s*:/gm)].map((match) => match[1]);
  for (const value of values) {
    const exported =
      new RegExp(`export\\s+(?:const|function)\\s+${value}\\b`).test(declaration) ||
      new RegExp(`as ${value}[ };]`).test(declaration);
    if (!exported) failures.push(`${resiPath}: ${value} is absent from ${declarationPath}`);
  }
}
if (failures.length) throw new Error(`ReScript declaration drift:\n${failures.join('\n')}`);
console.log('ReScript declaration exports verified.');
