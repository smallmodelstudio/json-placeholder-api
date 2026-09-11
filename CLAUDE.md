# CLAUDE.md

## Project Context

- **Overview and docs index:** `README.md`
- **Topic docs:** `docs/README-<topic>.md`

## Workflow Rules

1. Before starting work, read the docs for the area you're changing.
2. Follow the strict TypeScript rules in `tsconfig.json` (see `docs/README-code-quality.md`).
3. Documentation lives only in `docs/`, plus the root `README.md` index. Don't add
   Markdown files anywhere else.
4. When a change alters behaviour, commands or configuration covered in `docs/`,
   update that doc in the same change. Docs describe the current state, not its
   history.
