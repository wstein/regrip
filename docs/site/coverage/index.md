# Test coverage

All 66 measured source files meet the 90% line-coverage floor.

## Current reports

| Report | Line coverage | Files at 90%+ | Total floor |
| --- | ---: | ---: | ---: |
| Regrip Console and integration | 97.85% | 33/33 | 90% |
| Published core package | 95.56% | 33/33 | 95% |

The Console report merges unit and browser execution.

## Quality gates

- Every measured source file must have at least 90% line coverage.
- The Console total must have at least 90% line coverage.
- The published core package total must have at least 95% line coverage.

Run `npm run test:coverage` to regenerate this dashboard locally. The complete site build does the same before VitePress packages the Pages artifact.
