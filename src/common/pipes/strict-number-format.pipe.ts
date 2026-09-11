import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

// A plain base-10 integer only: optional leading "-", then "0" or a
// non-zero digit followed by more digits. Deliberately not the same regex
// as ParsePositiveIntPipe's — this pipe's job is only to reject JS number
// *literal syntax* (hex, exponential notation, a leading "+", surrounding
// whitespace) that Number()/+value would otherwise quietly accept; it isn't
// the place for id-specific rules like "must be positive", which stay in
// ParsePositiveIntPipe.
const PLAIN_INTEGER = /^-?(?:0|[1-9]\d*)$/;

/**
 * Registered globally, ahead of the app's ValidationPipe (see
 * app.module.ts) — the ordering is what makes this pipe useful, not just
 * its own logic.
 *
 * Nest's ValidationPipe, with `transform: true`, coerces any `@Param()` or
 * bare `@Query()` argument whose declared TypeScript type is `number` via
 * a lossy `+value` (ValidationPipe.transformPrimitive, in
 * @nestjs/common/pipes/validation.pipe.js) — and `+value` accepts hex
 * ("0x1" → 1), exponential notation ("1e2" → 100), a leading "+", and
 * surrounding whitespace, same as any other JS numeric literal. That
 * coercion happens whether or not the route also has its own pipe (e.g.
 * ParsePositiveIntPipe on `:id` params): @nestjs/core's
 * RouterExecutionContext always runs every global pipe ahead of a route's
 * param-level ones (`pipes.concat(paramPipes)` in
 * router-execution-context.js), with no per-route way to reorder that. So
 * by the time a route's own pipe sees the value, "0x1" is already gone,
 * replaced with the plain number 1 — nothing downstream can tell the two
 * apart any more.
 *
 * This pipe closes that gap by running the strict format check *before*
 * ValidationPipe's own coercion, while the value is still the original
 * string, for every bare-`number`-typed param/query in the app — the `:id`
 * route params today, and any future one with the same shape.
 */
@Injectable()
export class StrictNumberFormatPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (
      (metadata.type !== 'param' && metadata.type !== 'query') ||
      metadata.metatype !== Number ||
      typeof value !== 'string'
    ) {
      return value;
    }

    if (!PLAIN_INTEGER.test(value)) {
      const label = metadata.data ?? 'value';
      throw new BadRequestException(`${label} must be a plain integer`);
    }

    return value;
  }
}
