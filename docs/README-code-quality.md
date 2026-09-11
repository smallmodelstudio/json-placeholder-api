# Code quality

The static checks — linting, formatting and type-checking — and the compiler rules
they enforce.

## Checks

| Command | Tool | Config |
| --- | --- | --- |
| `npm run lint` | ESLint with `typescript-eslint`'s type-checked rules; formatting problems are reported as lint errors. Runs with `--fix`, so it rewrites files | `eslint.config.mjs` |
| `npm run lint:check` | Same rules, no `--fix` — fails instead of rewriting | `eslint.config.mjs` |
| `npm run format` | Prettier (single quotes, trailing commas) | `.prettierrc` |
| `npm run typecheck` | tsgo (TypeScript 7), no emit | `tsconfig.json` |

CI runs `lint:check`, `typecheck` and the unit tests in parallel. Using `lint`
(the auto-fixing one) in CI would let a formatting problem silently pass —
the job rewrites the file and still exits 0. `lint:check` is for CI; use
`lint` locally to fix what it finds.

## Two TypeScript versions

| Job | Tool | Why |
| --- | --- | --- |
| Build | `nest build` on TypeScript 6 | Stable emit with decorator metadata |
| Lint | `typescript-eslint` on TypeScript 6 | Needs the compiler's programmatic API |
| Type-check | `tsgo` (TypeScript 7, Go-native) | Much faster; checking alone needs no API |

TypeScript 7.0 has no stable programmatic API, so tools that load the compiler
as a library, such as `typescript-eslint`, still need TypeScript 6. Once 7.1 adds
that API, the build and lint can move to 7 and the 6.x pin can go.

## Strict compiler flags

On top of `strict`, `tsconfig.json` turns on:

| Flag | Effect | How to comply |
| --- | --- | --- |
| `noUncheckedIndexedAccess` | `arr[0]` is typed `T \| undefined` | Guard it explicitly; the codebase avoids `!` |
| `exactOptionalPropertyTypes` | An optional key can't be set to `undefined` | Omit the key with a conditional spread: `...(x !== undefined && { key: x })` (see `UpstreamService.toAxiosOptions()`) |
| `noPropertyAccessFromIndexSignature` | `process.env.PORT` is an error | Write `process.env['PORT']` |
| `noImplicitOverride` | Overriding a base-class method needs a keyword | Mark it `override` |
| `noUnusedLocals`, `noUnusedParameters` | Unused names are errors | Prefix a required-but-unused parameter with `_` |

`skipLibCheck` stays `true`. With it off, several dependencies'
`.d.ts` files fail these flags, and those errors can't be fixed from this repo.

There are no path aliases or `baseUrl`, so every internal import is relative.

## Lint rule overrides

These rules are relaxed from the recommended set:

- `@typescript-eslint/no-explicit-any` is off.
- `@typescript-eslint/no-floating-promises` is a warning.
- `@typescript-eslint/no-unsafe-argument` is a warning.
