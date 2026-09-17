import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  PipeTransform,
} from '@nestjs/common';
import { isZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

export interface ZodValidationPipeOptions {
  failClosed?: boolean;
}

const UNVALIDATED_METATYPES: unknown[] = [
  String,
  Number,
  Boolean,
  Object,
  Array,
];

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly failClosed: boolean;

  constructor({ failClosed = true }: ZodValidationPipeOptions = {}) {
    this.failClosed = failClosed;
  }

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    const { metatype } = metadata;

    if (isZodDto(metatype)) {
      // nestjs-zod types `.schema` as its own minimal `UnknownSchema`
      // interface (just `.parse()`), to allow non-zod validators too. Every
      // DTO in this codebase is built with `createZodDto` from an actual
      // zod schema, so it always has `.safeParse()`.
      const schema = metatype.schema as z.ZodType;
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new BadRequestException(
          result.error.issues.map(
            (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
          ),
        );
      }
      return result.data;
    }

    // Every request schema is a zod DTO, so a body or query argument that
    // isn't one has no validation at all — that's a bug in the route, not a
    // permissive case to fall through. Failing closed turns it into a 500
    // as soon as the route is hit, instead of an unvalidated payload
    // slipping through unnoticed.
    if (
      this.failClosed &&
      metatype !== undefined &&
      !UNVALIDATED_METATYPES.includes(metatype)
    ) {
      throw new InternalServerErrorException(
        `${metadata.type} argument has no zod DTO`,
      );
    }

    return value;
  }
}
