# Skill Rule: Progress Ledger Maintainer

Whenever the user states a task is finished, or after successfully running tests for a phase:

1. Move the current completed items under `## Completed Phases`.
2. Update `## Current Phase` to the next logical step from `PLAN.md`.
3. Add any crucial new decisions (e.g., customized pipe behaviors, path alias updates) under `## Active Context Architecture`.
4. Keep the file concise (under 50 lines) to preserve tokens for context switching.
