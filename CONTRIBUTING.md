# Contributing to Quikdown

Thank you for your interest in contributing to Quikdown. This guide covers the basics.

## Getting Started

```bash
git clone https://github.com/deftio/quikdown.git
cd quikdown
npm install
npm test
```

All tests should pass before you begin making changes.

## Development Workflow

1. Create a feature branch from `main`.
2. Make your changes in the `src/` directory.
3. Run `npm test` to execute the Jest test suite.
4. Run `npm run build` to generate the dist files and site.
5. Verify your changes work in a browser by opening the built site locally.

The files `quikdown.js` and `quikdown_bd.js` must maintain 100% test coverage
across all four metrics (statements, branches, functions, lines). If you modify
these files, add or update tests accordingly.

## Pull Request Guidelines

- Keep each PR focused on a single change or closely related set of changes.
- All tests must pass.
- Test coverage on `quikdown.js` and `quikdown_bd.js` must not drop below 100%.
- Include a clear description of what the PR does and why.
- Reference any related GitHub issues.

## Code Style

- No frameworks -- the project is pure HTML, CSS, and JavaScript.
- No CSS variables; prefer simple static CSS.
- Keep dependencies minimal. Avoid adding new ones unless absolutely necessary.
- Write clear, straightforward code. Favor readability over cleverness.

## Reporting Bugs

Please use [GitHub Issues](https://github.com/deftio/quikdown/issues) to report
bugs. Include:

- Steps to reproduce the problem.
- Expected vs. actual behavior.
- Browser and OS information if relevant.
- A minimal code sample or link demonstrating the issue.

## License

By contributing, you agree that your contributions will be licensed under the
[BSD-2-Clause License](LICENSE.txt).
