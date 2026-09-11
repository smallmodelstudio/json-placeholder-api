import { Logger } from '@nestjs/common';

const logger = new Logger('Shutdown');

/**
 * Runs `handler` once for each of the given process signals (default
 * SIGTERM/SIGINT), logging — rather than throwing — if it rejects.
 *
 * Extracted out of instrumentation.ts, whose own shutdown handler
 * (`sdk.shutdown()`) rejects when the OTel collector it's trying to flush
 * to is unreachable. `void sdk.shutdown()` let that rejection become an
 * uncaught rejection, which crashes the process with a non-zero exit code
 * on every SIGTERM in an environment with no collector (the prod overlay,
 * today) — the opposite of what a graceful-shutdown handler should do.
 */
export function registerShutdownHandler(
  handler: () => Promise<unknown>,
  signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'],
): void {
  for (const signal of signals) {
    process.on(signal, () => {
      handler().catch((error: unknown) => {
        logger.error(
          `Shutdown handler failed for ${signal}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }
}
