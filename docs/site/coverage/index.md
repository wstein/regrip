# Test coverage

All 66 measured source files meet the 90% line-coverage floor.

## Current reports

| Report | Line coverage | Files at 90%+ | Total floor |
| --- | ---: | ---: | ---: |
| [Regrip Console and integration](./app/index.html) | 97.85% | 33/33 | 90% |
| [Published core package](./core/index.html) | 95.56% | 33/33 | 95% |

The Console report merges unit and browser execution. Each report links to its standalone HTML detail view.

## Quality gates

- Every measured source file must have at least 90% line coverage.
- The Console total must have at least 90% line coverage.
- The published core package total must have at least 95% line coverage.

Run `npm run test:coverage` to regenerate these reports and this dashboard locally. The complete site build does the same before VitePress packages the Pages artifact.
