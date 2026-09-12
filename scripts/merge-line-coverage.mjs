import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, '.nyc_output_combined');
const reports = [
  join(root, 'docs/site/public/coverage/app-unit/lcov.info'),
  join(root, 'docs/site/public/coverage/app-browser/lcov.info'),
];

/** @type {Map<string, Map<number, number>>} */
const files = new Map();

for (const report of reports) {
  let currentFile;
  for (const line of readFileSync(report, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      const source = line.slice(3);
      currentFile = isAbsolute(source) ? source : resolve(root, source);
      if (!files.has(currentFile)) files.set(currentFile, new Map());
    } else if (currentFile && line.startsWith('DA:')) {
      const [lineNumberText, countText] = line.slice(3).split(',');
      const lineNumber = Number(lineNumberText);
      const count = Number(countText);
      const lines = files.get(currentFile);
      lines.set(lineNumber, Math.max(lines.get(lineNumber) ?? 0, count));
    } else if (line === 'end_of_record') {
      currentFile = undefined;
    }
  }
}

const coverage = {};
let totalLines = 0;
let coveredLines = 0;
for (const [file, lines] of files) {
  const sourceLines = readFileSync(file, 'utf8').split('\n');
  const statementMap = {};
  const statementCounts = {};
  [...lines.entries()]
    .sort(([left], [right]) => left - right)
    .forEach(([line, count], index) => {
      const key = String(index);
      statementMap[key] = {
        start: { line, column: 0 },
        end: { line, column: sourceLines[line - 1]?.length ?? 0 },
      };
      statementCounts[key] = count;
    });
  coverage[file] = {
    path: file,
    statementMap,
    fnMap: {},
    branchMap: {},
    s: statementCounts,
    f: {},
    b: {},
  };
  totalLines += lines.size;
  coveredLines += [...lines.values()].filter((count) => count > 0).length;
}

const minimumLineCoverage = 90;
const lineCoverage = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;
console.log(
  `Combined app line coverage: ${lineCoverage.toFixed(2)}% (${coveredLines}/${totalLines})`,
);
if (lineCoverage < minimumLineCoverage) {
  throw new Error(
    `Combined app line coverage ${lineCoverage.toFixed(2)}% is below ${minimumLineCoverage}%`,
  );
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'app.json'), JSON.stringify(coverage));
