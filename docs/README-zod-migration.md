# Zod migration plan

A working plan for replacing class-validator and class-transformer with zod. It
is written as a sequence of small tasks for an implementing agent. Tick each
task's checkbox in the same commit that completes it.

This file is temporary: the final task (5.3) deletes it once the migration has
landed, because `docs/` describes the current state, not work in progress.

## Rules for every task

- Read `CLAUDE.md`, `docs/README-architecture.md` and `docs/README-code-quality.md`
  before starting.
- Do one task at a time, and make one commit per task on the branch
  `refactor/zod-validation`.
- Don't use `!` non-null assertions, `as` casts or `eslint-disable` to get past
  `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess`. Use conditional
  spreads and explicit guards, as the rest of the codebase does.
- Keep every exported class and type name (`CreatePostDto`, `Post`, …) so
  controllers, services and their specs don't need to change.
- A task is done only when its **Done when** checks pass. If a check fails and
  the fix isn't obvious, stop and report instead of working around it.
- Tasks marked **STOP** end with a report to the user before continuing.

## What exists today

- **18 DTO files** (`src/modules/*/dto/`) using class-validator decorators.
  `update-*.dto.ts` files use `PartialType` from `@nestjs/swagger`.
- **6 entity files** (`src/modules/*/entities/`): plain classes. They serve as
  TypeScript types and, through the Swagger CLI plugin, as OpenAPI models
  referenced by `@ApiEnvelopedResponse()`.
- **`src/config/env.validation.ts`**: `plainToInstance` plus `validateSync` on an
  `EnvironmentVariables` class.
- **A global `ValidationPipe`** in `src/app.module.ts` with `whitelist`,
  `forbidNonWhitelisted`, `transform` and `enableImplicitConversion`.
- **`StrictNumberFormatPipe`**, registered ahead of `ValidationPipe`. It exists
  only because `ValidationPipe` coerces number-typed params with a lossy
  `+value`.
- **The Swagger CLI plugin** in `nest-cli.json`, which generates schemas from
  DTO and entity classes.

## Behaviour the migration must handle

These were checked against the running app, not just read from the code.

| # | Today | After migration | Why |
| --- | --- | --- | --- |
| 1 | `POST /todos {"userId":"1","title":123,"completed":"false"}` is accepted and forwarded upstream as `{userId:1, title:"123", completed:true}` | 400 | `enableImplicitConversion` coerces body fields by their TypeScript type. `"false"` becoming `true` is a bug |
| 2 | `GET /posts?userId=0x1` returns 200 | 400 | Query integers use a strict regex, not `Number()` or `z.coerce.number()` |
| 3 | `@IsUrl()` accepts `example.com/a.png` (no protocol) | 400 | URLs must be `http` or `https` |
| 4 | Unknown body or query properties return 400 | Unchanged | Every request schema, including nested objects, is a `z.strictObject` |
| 5 | Error `message` is a `string[]` (e2e tests assert `Array.isArray`) | Unchanged | Our own pipe throws `BadRequestException(string[])`; `nestjs-zod`'s default exception sends a single string |
| 6 | `/posts/0x1` and `/posts/1e2` return 400 | Unchanged | `ParsePositiveIntPipe` already enforces this; `StrictNumberFormatPipe` becomes unnecessary once `ValidationPipe` is gone |
| 7 | — | A `@Body()` or `@Query()` argument without a zod DTO fails with 500 | A zod pipe otherwise skips classes it doesn't recognise, leaving them unvalidated |

Rows 1–3 make the API stricter on purpose. The exact wording of validation
messages will change; no test asserts on it.

## Coexistence during the migration

`ValidationPipe` with `forbidNonWhitelisted` rejects every property of a
`createZodDto` class, because such a class has no class-validator decorators.
To keep e2e tests passing after each resource is converted, Phase 1 adds a
temporary `LegacyValidationPipe` subclass that skips zod DTOs. Phase 4 removes
it.

## Phase 0: Baseline and spike

### 0.1 Baseline

- [x] Done

1. Create the branch `refactor/zod-validation` from `master`.
2. Run `npm run lint:check`, `npm run typecheck`, `npm run test:cov` and
   `npm run test:e2e`. Record the coverage percentages in the commit message.
3. Run `npm run build`. Write a script **outside the repo** (in your scratch
   directory) that imports `AppModule` from `dist/src/app.module.js`, creates
   the app with `createFastifyAdapter()`, builds a document with
   `SwaggerModule.createDocument` using the same `DocumentBuilder` settings as
   `src/main.ts`, and writes it to `openapi-before.json` in the scratch
   directory. Set the env vars it needs from `.env.example`.

**Done when:** all four commands pass and `openapi-before.json` exists. This
task has no commit unless something needed fixing.

### 0.2 Dependency spike — STOP

- [x] Done

1. `npm install zod@^4 nestjs-zod`. If npm reports a peer-dependency conflict
   with Nest 12, add an `overrides` entry for `nestjs-zod` in `package.json`,
   following the existing `@nestjs/throttler` entry. Don't use
   `--legacy-peer-deps`.
2. Read the installed `node_modules/nestjs-zod/README.md` and confirm the exact
   names and signatures of `createZodDto`, `isZodDto` and `cleanupOpenApiDoc`.
   Later tasks use these names; note any differences in the report.
3. As a trial only, convert `CreatePostDto` and `QueryPostsDto` (see task 2.1
   for the shape), and register a minimal zod pipe so the app boots. Confirm:
   - a) `npm run build` and `npm run test:e2e -- posts` both compile the
     classes (nest build uses tsc; Vitest uses swc);
   - b) the generated OpenAPI document (script from 0.1, after cleaning it with
     `cleanupOpenApiDoc`) shows the `POST /posts` request body schema and the
     `userId` query parameter on `GET /posts`;
   - c) a field that uses `.transform()` (the query `userId`) is documented with
     its input type (string with a pattern), not omitted.
4. Revert the trial changes, but keep the dependency install and any
   `overrides` entry. Commit only `package.json` and `package-lock.json`.

**Report:** results of a), b) and c), plus any API name differences. If b) or
c) fails, the fallback is a small in-house `createZodDto` built on
`z.toJSONSchema()`. That is a change of approach for the user to approve, not
something to improvise.

## Phase 1: Foundations

Nothing in this phase changes API behaviour.

### 1.1 Shared field schemas

- [x] Done

Create `src/common/validation/fields.ts` and `fields.spec.ts` next to it.
Export:

| Name | Definition | Replaces |
| --- | --- | --- |
| `nonEmptyString` | `z.string().min(1)` | `@IsString() @IsNotEmpty()` |
| `positiveIntBody` | `z.number().int().positive()` (numbers only, no strings) | `@Type(() => Number) @IsInt() @IsPositive()` in bodies and entities |
| `positiveIntQuery` | `z.string().regex(/^[1-9]\d*$/).transform(Number)` | the same decorators in query DTOs |
| `httpUrl` | `z.url({ protocol: /^https?$/ })` | `@IsUrl()` |
| `email` | `z.email()` | `@IsEmail()` |
| `latitudeString` | a string that parses (with `Number()`, after a plain decimal regex such as `/^-?\d+(\.\d+)?$/`) to a finite number from -90 to 90 | `@IsLatitude()` |
| `longitudeString` | the same, from -180 to 180 | `@IsLongitude()` |

The spec covers each schema with valid and invalid inputs. Include at least:
`"0x1"`, `"1e2"`, `""`, `" 1"`, `"-1"`, `"0"` and `"01"` for `positiveIntQuery`;
`"1"` and `1.5` for `positiveIntBody`; `"example.com/a.png"` and
`"ftp://example.com"` for `httpUrl`; `"90.0001"` and `"abc"` for
`latitudeString`.

**Done when:** `typecheck`, `lint:check` and `test` pass.

### 1.2 `ZodValidationPipe`

- [x] Done

Create `src/common/pipes/zod-validation.pipe.ts` and its spec.

- Constructor option `{ failClosed: boolean }`, defaulting to `true`.
- `transform(value, metadata)`:
  - If `metadata.type` is not `'body'` or `'query'`, return `value` unchanged.
  - If `isZodDto(metadata.metatype)`: run the DTO's schema `safeParse(value)`.
    On success return the parsed data. On failure throw
    `new BadRequestException(issues.map((i) => \`${i.path.join('.') || '(root)'}: ${i.message}\`))`.
  - Otherwise, if `failClosed` is `true` and `metatype` is a class other than
    `String`, `Number`, `Boolean`, `Object` or `Array`, throw
    `InternalServerErrorException` with a message naming the argument, e.g.
    `body argument has no zod DTO`.
  - Otherwise return `value` unchanged.
- Add a short comment explaining why it fails closed (row 7 in the table
  above).

Spec cases: valid body returns parsed data (including a transformed query
value); invalid body throws 400 with a `string[]` message containing the field
path; nested path is dotted (`address.geo.lat`); `param` metadata is untouched;
a non-zod class with `failClosed: true` throws 500; the same with
`failClosed: false` passes through; a primitive metatype passes through.

**Done when:** `typecheck`, `lint:check` and `test` pass.

### 1.3 Register both pipes

- [x] Done

In `src/app.module.ts`:

1. Add, in the same file, a `LegacyValidationPipe extends ValidationPipe` whose
   `protected override toValidate(metadata: ArgumentMetadata): boolean` returns
   `!isZodDto(metadata.metatype) && super.toValidate(metadata)`. Comment it as
   temporary, removed in task 4.1.
2. Register the `APP_PIPE` providers in this order:
   1. `StrictNumberFormatPipe` (unchanged)
   2. `ZodValidationPipe` with `failClosed: false`
   3. `LegacyValidationPipe` with the same options `ValidationPipe` has today

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass with no
test changes.

## Phase 2: Convert resources

Do **posts first** and stop for review, because it becomes the template. Then
todos, albums, comments, photos, and users last.

### Pattern for each resource

For a resource `x` with entity `X`:

- **`entities/x.entity.ts`**

  ```ts
  export const XSchema = z.strictObject({
    id: positiveIntBody,
    // …fields, using the helpers from common/validation/fields.ts
  });

  export class X extends createZodDto(XSchema) {}
  ```

- **`dto/create-x.dto.ts`**

  ```ts
  export const CreateXSchema = XSchema.omit({ id: true });

  export class CreateXDto extends createZodDto(CreateXSchema) {}
  ```

- **`dto/update-x.dto.ts`**: `CreateXSchema.partial()` and `UpdateXDto`. Like
  `PartialType`, `.partial()` is shallow: nested objects become optional, but
  their own fields stay required.
- **`dto/query-x.dto.ts`**: `z.strictObject({ … })` with every field
  `.optional()`, using `positiveIntQuery` for integer filters.
- Don't change controllers or services, except comments that mention
  `PartialType`.
- If typecheck fails in a service or spec because of optional fields under
  `exactOptionalPropertyTypes`, fix it with a conditional spread.

### Tests to add for each resource

In `test/e2e/<x>.e2e.spec.ts`, next to the existing 400 cases:

- a numeric foreign key sent as a string in a `POST` body returns 400;
- an unknown property in a `POST` body returns 400;
- `?<foreign key>=0x1` on the list route returns 400 (where the resource has an
  integer query filter).

### 2.1 Posts — STOP after this task

- [x] Done

Fields: `id`, `userId` (positive int), `title`, `body` (non-empty strings).
Query: `userId`.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass. Report
the diff for review before continuing.

### 2.2 Todos

- [ ] Done

Fields: `id`, `userId`, `title`, `completed` (`z.boolean()`). Query: `userId`.
Extra e2e test: `completed: "false"` in a `POST` body returns 400.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass.

### 2.3 Albums

- [ ] Done

Fields: `id`, `userId`, `title`. Query: `userId`.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass.

### 2.4 Comments

- [ ] Done

Fields: `id`, `postId`, `name`, `email` (`email`), `body`. Query: check the
existing `query-comments.dto.ts` and keep its fields.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass.

### 2.5 Photos

- [ ] Done

Fields: `id`, `albumId`, `title`, `url` and `thumbnailUrl` (`httpUrl`). Query:
check the existing `query-photos.dto.ts` and keep its fields. Extra e2e test: a
`url` without a protocol returns 400.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass.

### 2.6 Users

- [ ] Done

- In `user.entity.ts`, define and export `GeoSchema` (`lat: latitudeString`,
  `lng: longitudeString`), `AddressSchema` (`street`, `suite`, `city`,
  `zipcode`, `geo`), `CompanySchema` (`name`, `catchPhrase`, `bs`) and
  `UserSchema` (`id`, `name`, `username`, `email`, `address`, `phone`,
  `website`, `company`). All are `z.strictObject`. Keep exporting `Geo`,
  `Address` and `Company` as `createZodDto` classes, since they are exported
  today.
- `@IsNotEmptyObject()` needs no replacement: the nested objects' required
  fields already reject `{}`.
- Query: `username` (`nonEmptyString.optional()`), `email`
  (`email.optional()`).
- Extra e2e tests: an unknown key inside `address.geo` returns 400; `lat` of
  `"91"` returns 400; `?email=not-an-email` still returns 400.

**Done when:** `typecheck`, `lint:check`, `test` and `test:e2e` pass.

## Phase 3: Environment validation

This phase doesn't depend on Phase 2 and can be done any time after 0.2.

### 3.1 Rewrite `env.validation.ts`

- [ ] Done

In `src/config/env.validation.ts`:

- Keep the exported `Environment` enum (`config.types.ts` imports it) and the
  `validate(config: Record<string, unknown>)` signature.
- Replace the class with an `EnvironmentVariablesSchema` built with
  `z.looseObject`, so undeclared environment variables are kept, as today.
- Fields and defaults, matching the current class exactly:

  | Variable | Schema |
  | --- | --- |
  | `NODE_ENV` | `z.enum(Environment).default(Environment.Development)` |
  | `PORT` | `z.coerce.number().int().min(0).max(65535).default(3000)` |
  | `UPSTREAM_BASE_URL` | `z.url({ protocol: /^https?$/ }).default('https://jsonplaceholder.typicode.com')` |
  | `UPSTREAM_TIMEOUT_MS` | `z.coerce.number().int().min(1).default(5000)` |
  | `UPSTREAM_MAX_RETRIES` | `z.coerce.number().int().min(0).default(2)` |
  | `CACHE_TTL_MS` | `z.coerce.number().int().min(0).default(30000)` |
  | `THROTTLE_TTL_MS` | `z.coerce.number().int().min(1).default(60000)` |
  | `THROTTLE_LIMIT` | `z.coerce.number().int().min(1).default(20)` |

- On failure throw
  `new Error(\`Invalid environment variables:\n${z.prettifyError(result.error)}\`)`.
- Return type: `z.output<typeof EnvironmentVariablesSchema>`, exported as a type
  named `EnvironmentVariables`.
- Remove the `reflect-metadata` import from this file. Keep the package; Nest
  needs it.

Add spec cases to `env.validation.spec.ts`: `PORT: '1.5'` is rejected; a
`UPSTREAM_BASE_URL` of `ftp://example.com` is rejected; an undeclared variable
(e.g. `FOO: 'bar'`) is preserved in the result.

**Done when:** the existing spec cases pass unchanged, plus the new ones, and
`typecheck`, `lint:check` and `test:e2e` pass.

## Phase 4: Cutover and cleanup

### 4.1 Remove the old pipes and dependencies

- [ ] Done

1. In `src/app.module.ts`: delete `LegacyValidationPipe` and the
   `StrictNumberFormatPipe` provider. Register `ZodValidationPipe` with
   `failClosed: true` as the only `APP_PIPE`. Rewrite the pipe comment to
   describe the current setup.
2. Delete `src/common/pipes/strict-number-format.pipe.ts` and its spec.
3. In `src/common/pipes/parse-positive-int.pipe.ts`, remove the comment
   paragraph about the global `ValidationPipe` and `StrictNumberFormatPipe`.
   Keep the paragraph about why `Number()` alone is too permissive.
4. `npm uninstall class-validator class-transformer`.
5. Run
   `grep -rn "class-validator\|class-transformer\|ValidationPipe\|PartialType\|StrictNumberFormat" src test docs eslint.config.mjs`.
   The only matches allowed are `ZodValidationPipe` and this plan file.

**Done when:** `typecheck`, `lint:check`, `test:cov` (coverage thresholds must
still pass) and `test:e2e` pass. The `/posts/0x1` and `/posts/1e2` e2e tests
must still pass unchanged.

### 4.2 Swagger — STOP

- [ ] Done

1. Remove `"plugins": ["@nestjs/swagger"]` from `nest-cli.json`.
2. In `src/main.ts`, pass the document through `cleanupOpenApiDoc()` before
   `SwaggerModule.setup`. Update the `setDescription` text if it mentions class
   DTOs (it currently says "typed DTOs", which is still accurate).
3. Run `npm run build`, update the 0.1 script to apply `cleanupOpenApiDoc`, and
   write `openapi-after.json`. Diff it against `openapi-before.json`.

Expected differences: stricter formats and patterns, `additionalProperties:
false`, integer types on ids and foreign keys.

Not acceptable: any route losing its request body schema, a list route losing
its query parameters, or a response losing its `$ref` to an entity schema.

**Report:** a summary of the diff grouped as expected or unexpected.

**Done when:** no unacceptable differences.

### 4.3 Full verification

- [ ] Done

1. `npm run lint:check`, `npm run typecheck`, `npm run test:cov`,
   `npm run test:e2e`.
2. `npm run build && npm run start:prod` (with `.env` or env vars from
   `.env.example`), then check:
   - `GET /docs` loads and shows request bodies;
   - `POST /posts` with `{}` returns a 400 error envelope whose `message` is an
     array;
   - `POST /posts` with a valid body returns 201.
3. Start with `PORT=abc` and confirm the process exits with
   `Invalid environment variables`.

**Done when:** all of the above pass.

## Phase 5: Documentation

### 5.1 `docs/README-architecture.md`

- [ ] Done

- **Layout block:** `entities/` becomes "response shapes (zod schemas)";
  `dto/` becomes "query, create and update inputs (zod schemas)"; `pipes/`
  becomes "ZodValidationPipe (global) and ParsePositiveIntPipe for :id
  params"; add `common/validation/` for shared field schemas.
- **Request lifecycle:** replace the `ValidationPipe` line with
  `ZodValidationPipe       validate and transform query and body against zod DTOs`.
- **Cross-cutting table:**
  - Validation row: unknown properties or query params return 400; body
    numbers must be JSON numbers; query integers must be plain digits; URLs
    must be http or https; a `@Body()` or `@Query()` without a zod DTO returns
    500. Location: `zod-validation.pipe.ts`, `common/validation/fields.ts`.
  - API docs row: `createZodDto` classes provide the schemas and
    `cleanupOpenApiDoc()` in `main.ts` post-processes the document; no CLI
    plugin.
- **Gotchas:** reword the `forbidNonWhitelisted` bullet: request schemas are
  `z.strictObject`, so every new query param needs a field on its schema. Add a
  bullet: build fields from `common/validation/fields.ts` rather than
  `z.coerce`, which accepts hex and exponent formats.
- Write it as the current state, with no "migrated from" wording.

### 5.2 Other docs

- [ ] Done

- `docs/README-getting-started.md`: check the env validation paragraph is still
  accurate.
- `docs/README-code-quality.md`: check nothing refers to decorators on DTOs.
- Root `README.md`: add zod to the **Stack** line.

### 5.3 Delete this plan

- [ ] Done

Delete `docs/README-zod-migration.md` and confirm nothing links to it
(`grep -rn "zod-migration" .`).

## Out of scope

- Validating upstream responses at runtime (e.g. calling `PostSchema.parse()`
  in services or the contract test). Easy to add once entities are zod schemas.
- The `defineResource` contract abstraction planned for the nest-kit library.
