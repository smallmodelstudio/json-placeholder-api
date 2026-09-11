import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

// Only ASCII decimal digits, no leading zero — Number() alone is too
// permissive for a route param: it accepts hex ("0x1" → 1), exponential
// notation ("1e2" → 100), leading/trailing whitespace, and other JS number
// literal syntax nobody types into a URL by hand. Rejecting anything that
// doesn't match this shape first, and only then parsing it, is safer than
// trying to validate Number()'s result after the fact.
//
// This alone doesn't actually stop those formats reaching an upstream call
// as a valid id, though: the global ValidationPipe (app.module.ts) already
// coerces this same value via a lossy `+value` — which accepts exactly the
// formats above — before this pipe ever runs, since Nest always runs global
// pipes ahead of a route's own param-level ones. By the time this pipe sees
// "0x1", ValidationPipe has already turned it into the number 1. Closing
// that gap is StrictNumberFormatPipe's job (registered globally, ahead of
// ValidationPipe) — this pipe's own check still matters for the id-specific
// rules StrictNumberFormatPipe doesn't enforce (positive, no leading zero)
// and for any test or future caller that constructs it directly.
const POSITIVE_INTEGER = /^[1-9]\d*$/;

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const label = metadata.data ?? 'value';

    if (!POSITIVE_INTEGER.test(value)) {
      throw new BadRequestException(`${label} must be a positive integer`);
    }

    return Number(value);
  }
}
