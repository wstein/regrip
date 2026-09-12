# Test coverage

The generated reports show statement, branch, function, and line coverage. Core enforces at least
95% line coverage; the combined Console unit/browser report enforces at least 90% line coverage.

## Reports

- <a href="./app/index.html" target="_self">Regrip Console and integration coverage</a>
- <a href="./core/index.html" target="_self">Published core package coverage</a>

The explicit `index.html` targets and same-tab navigation bypass VitePress routing because these
reports are standalone Istanbul HTML applications, not VitePress pages.

Run `npm run test:coverage` locally to regenerate both reports. The complete site build generates
them automatically before VitePress packages the documentation.
