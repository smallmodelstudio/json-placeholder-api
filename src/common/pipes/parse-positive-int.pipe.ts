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
