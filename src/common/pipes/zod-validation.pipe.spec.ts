import { describe, it, expect } from 'vitest';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const BodySchema = z.strictObject({
  title: z.string().min(1),
});
class BodyDto extends createZodDto(BodySchema) {}

const QuerySchema = z.strictObject({
  userId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .optional(),
});
class QueryDto extends createZodDto(QuerySchema) {}

const NestedSchema = z.strictObject({
  address: z.strictObject({
    geo: z.strictObject({
      lat: z.string().min(1),
    }),
  }),
});
class NestedDto extends createZodDto(NestedSchema) {}

class NotAZodDto {}

describe('ZodValidationPipe', () => {
  it('returns the parsed data for a valid body', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'body', metatype: BodyDto };

    expect(pipe.transform({ title: 'hello' }, metadata)).toEqual({
      title: 'hello',
    });
  });

  it('returns the transformed data for a valid query', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'query', metatype: QueryDto };

    expect(pipe.transform({ userId: '7' }, metadata)).toEqual({ userId: 7 });
  });

  it('throws a 400 with a string[] message for an invalid body', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'body', metatype: BodyDto };

    try {
      pipe.transform({ title: '' }, metadata);
      expect.fail('expected transform to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(Array.isArray(response.message)).toBe(true);
      expect(response.message[0]).toContain('title');
    }
  });

  it('dots a nested path in the error message', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'body', metatype: NestedDto };

    try {
      pipe.transform({ address: { geo: { lat: '' } } }, metadata);
      expect.fail('expected transform to throw');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(response.message[0]).toContain('address.geo.lat');
    }
  });

  it('leaves param metadata untouched', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'param', metatype: BodyDto };

    expect(pipe.transform('anything', metadata)).toBe('anything');
  });

  it('throws a 500 for a non-zod class when failClosed is true', () => {
    const pipe = new ZodValidationPipe({ failClosed: true });
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: NotAZodDto,
    };

    expect(() => pipe.transform({}, metadata)).toThrow(
      'body argument has no zod DTO',
    );
  });

  it('passes a non-zod class through when failClosed is false', () => {
    const pipe = new ZodValidationPipe({ failClosed: false });
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: NotAZodDto,
    };

    expect(pipe.transform({ anything: 'goes' }, metadata)).toEqual({
      anything: 'goes',
    });
  });

  it('passes a primitive metatype through', () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: 'query', metatype: String };

    expect(pipe.transform('anything', metadata)).toBe('anything');
  });
});
