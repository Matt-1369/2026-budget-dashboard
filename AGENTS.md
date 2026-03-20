# Repository Guidelines

## Project Structure & Module Organization
This repository is currently an empty project skeleton: only the Git metadata directory (`.git/`) exists. There is no application source, test suite, or build configuration checked in yet.

When adding the first implementation, keep the layout predictable:

- `src/` for application code
- `tests/` for automated tests
- `public/` or `assets/` for static files
- `docs/` for design notes or architecture decisions

Prefer small, focused modules. Organize by feature or domain once the codebase grows, for example `src/dashboard/`, `src/budget/`, and `src/shared/`.

## Build, Test, and Development Commands
No build, test, or local development commands are configured yet. Contributors should add scripts alongside the chosen toolchain and document them in the project manifest and README.

Typical commands to introduce early:

- `npm install` to install dependencies
- `npm run dev` to start a local development server
- `npm test` to run the test suite
- `npm run lint` to check formatting and code quality

Keep command names conventional so new contributors can onboard quickly.

## Coding Style & Naming Conventions
Use consistent formatting from the start. Unless the selected stack requires otherwise:

- Use 2-space indentation for JavaScript, TypeScript, JSON, and YAML
- Use `camelCase` for variables and functions
- Use `PascalCase` for components, classes, and type names
- Use `kebab-case` for file and directory names unless framework conventions differ

Adopt an automated formatter and linter early, such as Prettier and ESLint, and commit their configuration files with the first source changes.

## Testing Guidelines
There is no test framework configured yet. Add tests with the first feature work instead of postponing coverage.

- Place unit tests in `tests/` or beside source files using `*.test.*`
- Name tests after observable behavior, not implementation details
- Add regression tests for every bug fix

Document the chosen framework and the exact test command once introduced.

## Commit & Pull Request Guidelines
This repository has no commit history yet, so there is no established convention to mirror. Start with short, imperative commit messages such as `Add budget summary model` or `Set up Vitest`.

Pull requests should include:

- A clear summary of the change
- Linked issue or task reference, if available
- Screenshots for UI work
- Notes on setup, migrations, or follow-up work

Keep PRs small enough to review quickly and verify locally before opening them.
