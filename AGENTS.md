# AGENTS.md — Cathy

Guidelines for agentic coding agents working in this repository.

## Project Overview

`@levibostian/cathy` is a zero-dependency TypeScript library for creating,
updating, and deleting comments on GitHub pull requests and issues. Published to
JSR, which generates equivalent packages for Node.js, Bun, and other runtimes.
The public API surface is `speak()` and `remove()` exported from `mod.ts`.

Key concepts:

- `speak()` — creates or updates a GitHub issue/PR comment
- `remove()` — deletes a comment previously posted by cathy
- `updateID` — an opaque string (or array of strings) embedded as a hidden HTML
  comment (`<!-- ... id:{updateID} -->`) so the same comment can be found and
  updated on subsequent runs

## Repository Layout

- `mod.ts` — public entry-point; re-exports the public API for Deno/JSR consumers
- `src/` — all implementation and tests; contains a low-level GitHub REST API
  client (with an injectable `HttpRequester` for testing) and the business logic
  for creating, updating, appending, and deleting comments
- `deno.jsonc` — Deno config: tasks, formatter/linter rules, import map
- `deno.lock` — frozen lockfile; do not manually edit

When exploring the codebase, use `ls`/`glob` tools to discover the current file
structure rather than relying on any specific filenames listed here.

## Build / Lint / Test Commands

All tasks are defined in `deno.jsonc`.

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `deno task test`    | Run all tests (`src/`)                 |
| `deno task fmt`     | Format all files in place              |
| `deno task lint`    | Lint the project                       |
| `deno fmt --check`  | Check formatting without writing files |
| `deno check mod.ts` | Type-check without emitting            |
| `deno publish`      | Publish to JSR                         |

### Running a single test

Use Deno's built-in `--filter` flag (substring match on the test name):

```sh
deno test src/ --filter "given updateExisting=true and existing comment"
```

Or target a single test file directly:

```sh
deno test src/comment.test.ts
deno test src/github.test.ts
```

### Quality checklist (run after every change you make)

1. `deno fmt`
2. `deno task lint`
3. `deno task test`

## Code Style

### Formatting (enforced by `deno fmt`)

- **No semicolons** (`semiColons: false`)
- **2-space indentation** (`indentWidth: 2`)
- **No tabs** (`useTabs: false`)
- **Line width: 120 characters** (`lineWidth: 120`)
- Always run `deno fmt` after changes you make; CI enforces `deno fmt --check`

### Functions and Exports

- Prefer **named function declarations** (`export function foo(...)`) for
  top-level exported functions. Arrow functions are fine for callbacks,
  closures, and factory-returned functions.
- **Factory pattern** is used for dependency injection: `createGitHubClient()`
  and `createCommentClient()` accept an optional `HttpRequester` so HTTP calls
  can be replaced in tests without mocking globals.
- Module-level default instances are exported as named constants
  (`export const findPreviousComment = defaultClient.findPreviousComment`).
  Callers should prefer these convenience exports; they are the real public API.

### Error Handling

- Propagate errors from the GitHub API as thrown `Error` instances with a
  descriptive message (see `defaultHttpRequester` in `src/github.ts`).
- Do **not** swallow errors silently. Functions that can legitimately find
  nothing return `undefined` or an empty array; they do not throw.
- Guard against falsy/empty inputs early and return without side-effects:
  ```ts
  if (!message) return;
  ```

### Comments and Documentation

- All **exported symbols** should have a JSDoc comment explaining purpose,
  parameters, and any non-obvious behaviour.
- Use `/** ... */` JSDoc style, not `//` line comments, for public API docs.
- Inline `// deno-lint-ignore <rule>` directives are acceptable only when
  unavoidable (e.g. `no-await-in-loop` inside pagination loops); add a brief
  explanation if not obvious.
- Use section separator comments (`// ---…--- // Subject`) to organise test
  files into clearly delimited groups.

## Testing Conventions

- Test runner: **Deno's built-in** (`Deno.test()`). No external test framework.
- Assertions: `@std/assert` (`assertEquals`, etc.).
- **Never make real HTTP calls in tests.** All GitHub API interactions go
  through the injectable `HttpRequester` type. Tests provide a mock requester.
- Prefer a **stateful mock class** (`MockGitHub` in `comment.test.ts`) when a
  test suite needs to simulate a realistic server across multiple operations.
- Prefer a **stateless mock factory** (`makeMockRequester` in `github.test.ts`)
  when tests only need to assert on individual HTTP calls.
- Each test is **self-contained**: create a fresh mock and client instance per
  test case.
- Test names are the source of truth for behaviour; write them as human-readable
  sentences before writing implementation.

## Runtime Compatibility

This library is written in Deno and published to JSR, which automatically
generates equivalent packages for Node.js, Bun, and other runtimes. To keep
that cross-runtime guarantee intact:

- **Do not call `Deno.*` APIs** (e.g. `Deno.env`, `Deno.readFile`, Deno-native
  `fetch`) anywhere in `src/` or `mod.ts`. These only exist at runtime on Deno
  and will break Node and Bun consumers.
- **Use `node:*` built-ins** for any I/O needs (e.g. `import https from "node:https"`).
  The `node:` prefix is supported in Deno 2 and Node 18+, and JSR handles the
  translation for Bun.
- If you need a new I/O dependency, check whether a `node:*` built-in covers
  the use case before reaching for a third-party package.

## Publishing

- `deno.jsonc` declares `"name": "@levibostian/cathy"` and `"exports": "./mod.ts"`.
- Published files: all `**/*.ts` + `README.md` + `LICENSE`; test files are
  excluded via `"exclude": ["**/*.test.ts"]`.
- The lockfile is **frozen** (`"frozen": true`); run `deno cache --reload` to
  update it intentionally, then commit `deno.lock`.
