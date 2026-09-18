# Changelog

All notable product changes are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Core package changes belong in [packages/core/CHANGELOG.md](packages/core/CHANGELOG.md).

## [Unreleased]

### Added

- Product releases can use `regrip-v<version>` tags, independently of core-package releases.
- A Western/Japanese color scheme toggle above the cube view, affecting the orientation gizmo and
  the color-facelets export. The live 3D cube keeps rendering standard Western colors.

### Changed

- The Console links a released build to its matching `regrip-v*` or `core-v*` GitHub Release; an
  unreleased build continues to link to its immutable commit.
