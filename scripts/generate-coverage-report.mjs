import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = resolve(root, 'docs/site/coverage/index.md');
const reports = [
  {
    id: 'app',
    label: 'Regrip Console and integration',
    frameTitle: 'Regrip Console coverage report',
    href: './app/index.html',
    totalLineFloor: 90,
  },
  {
    id: 'core',
    label: 'Published core package',
    frameTitle: 'Published core package coverage report',
    href: './core/index.html',
    totalLineFloor: 95,
  },
];
const fileLineFloor = 90;

const percent = (value) => `${value.toFixed(2)}%`;

const summaries = reports.map((report) => {
  const summaryPath = resolve(root, `docs/site/public/coverage/${report.id}/coverage-summary.json`);
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const files = Object.entries(summary)
    .filter(([path]) => path !== 'total')
    .map(([path, metrics]) => ({ path: relative(root, path), lines: metrics.lines.pct }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const belowFileFloor = files.filter((file) => file.lines < fileLineFloor);
  return { ...report, total: summary.total.lines.pct, files, belowFileFloor };
});

const violations = summaries.flatMap((report) => [
  ...(report.total < report.totalLineFloor
    ? [
        `${report.label} total line coverage is ${percent(report.total)} (minimum ${report.totalLineFloor}%)`,
      ]
    : []),
  ...report.belowFileFloor.map(
    (file) => `${file.path} is ${percent(file.lines)} (minimum ${fileLineFloor}%)`,
  ),
]);

const reportRows = summaries
  .map(
    (report) =>
      `| [${report.label}](${report.href}) | ${percent(report.total)} | ${report.files.length - report.belowFileFloor.length}/${report.files.length} | ${report.totalLineFloor}% |`,
  )
  .join('\n');
const embeddedReports = summaries
  .map(
    (report) => `<details class="coverage-embed">
<summary><strong>${report.label}</strong> — ${percent(report.total)} line coverage</summary>
<iframe
  title="${report.frameTitle}"
  src="${report.href}"
  loading="lazy"
></iframe>
</details>`,
  )
  .join('\n\n');
const failedFiles = summaries.flatMap((report) => report.belowFileFloor);
const status =
  violations.length === 0
    ? `All ${summaries.reduce((count, report) => count + report.files.length, 0)} measured source files meet the ${fileLineFloor}% line-coverage floor.`
    : `The coverage floor has ${violations.length} violation${violations.length === 1 ? '' : 's'}.`;
const failureDetails =
  failedFiles.length === 0
    ? ''
    : `\n## Files below the floor\n\n${failedFiles
        .map((file) => `- \`${file.path}\`: ${percent(file.lines)}`)
        .join('\n')}\n`;

writeFileSync(
  reportPath,
  `# Test coverage\n\n${status}\n\n## Current reports\n\n| Report | Line coverage | Files at 90%+ | Total floor |\n| --- | ---: | ---: | ---: |\n${reportRows}\n\nThe Console report merges unit and browser execution. The complete reports are embedded below and each table link opens its standalone HTML detail view.\n\n## Embedded reports\n\n${embeddedReports}\n\n## Quality gates\n\n- Every measured source file must have at least ${fileLineFloor}% line coverage.\n- The Console total must have at least 90% line coverage.\n- The published core package total must have at least 95% line coverage.\n\nRun \`npm run test:coverage\` to regenerate these reports and this dashboard locally. The complete site build does the same before VitePress packages the Pages artifact.\n${failureDetails}`,
);

if (violations.length > 0) {
  throw new Error(
    `Coverage requirements failed:\n${violations.map((violation) => `- ${violation}`).join('\n')}`,
  );
}
