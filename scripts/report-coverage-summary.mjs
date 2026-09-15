import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  {
    name: 'Core package',
    threshold: 95,
    report: join(root, 'docs/site/public/coverage/core/coverage-summary.json'),
  },
  {
    name: 'Console + browser',
    threshold: 90,
    report: join(root, 'docs/site/public/coverage/app/coverage-summary.json'),
  },
];

let allPassed = true;
const rows = suites.map(({ name, threshold, report }) => {
  if (!existsSync(report)) {
    allPassed = false;
    return `| ${name} | Not generated | ≥ ${threshold}% | ⚠️ |`;
  }
  const summary = JSON.parse(readFileSync(report, 'utf8')).total.lines;
  const passed = summary.pct >= threshold;
  if (!passed) allPassed = false;
  return `| ${name} | **${summary.pct.toFixed(2)}%** (${summary.covered}/${summary.total}) | ≥ ${threshold}% | ${passed ? '✅' : '❌'} |`;
});

const markdown = [
  '## Test coverage',
  '',
  '| Scope | Line coverage | Required | Result |',
  '| --- | ---: | ---: | :---: |',
  ...rows,
  '',
  'The Console figure combines unit and browser line execution.',
  '',
].join('\n');

process.stdout.write(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
// Actually enforce the gates the table claims: fail the job (and therefore the
// CI run and the Pages deploy that depends on it) below either threshold.
if (!allPassed) process.exit(1);
