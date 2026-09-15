# Test coverage

All 66 measured source files meet the 90% line-coverage floor.

## Current reports

<details class="coverage-embed">
<summary><strong>Regrip Console and integration</strong> — 97.85% line coverage</summary>
<iframe
  title="Regrip Console coverage report"
  src="./app/index.html"
  loading="lazy"
></iframe>
</details>

<details class="coverage-embed">
<summary><strong>Published core package</strong> — 95.56% line coverage</summary>
<iframe
  title="Published core package coverage report"
  src="./core/index.html"
  loading="lazy"
></iframe>
</details>

## Quality gates

- Every measured source file must have at least 90% line coverage.
- The Console total must have at least 90% line coverage.
- The published core package total must have at least 95% line coverage.

Run `npm run test:coverage` to regenerate these reports and this dashboard locally. The complete site build does the same before VitePress packages the Pages artifact.
