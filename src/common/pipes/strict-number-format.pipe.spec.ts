import { describe, it, beforeEach, expect } from 'vitest';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { StrictNumberFormatPipe } from './strict-number-format.pipe';

describe('StrictNumberFormatPipe', () => {
  let pipe: StrictNumberFormatPipe;
  const paramMetadata: ArgumentMetadata = {
    type: 'param',
    data: 'id',
    metatype: Number,
  };

  beforeEach(() => {
    pipe = new StrictNumberFormatPipe();
  });

  it.each(['1', '42', '0', '-5'])(
    'passes a plain integer %p through unchanged',
    (value) => {
      expect(pipe.transform(value, paramMetadata)).toBe(value);
    },
  );

  it.each([
    '0x1', // hex
    '1e2', // exponential
    '+1', // explicit sign
    ' 1', // leading whitespace
    '1 ', // trailing whitespace
    'Infinity',
    'abc',
    '1.5',
  ])('rejects %p for a Number-typed param', (value) => {
    expect(() => pipe.transform(value, paramMetadata)).toThrow(
      BadRequestException,
    );
  });

  it('passes non-Number-typed params through unchanged', () => {
    const metadata: ArgumentMetadata = {
      type: 'param',
      data: 'slug',
      metatype: String,
    };

    expect(pipe.transform('0x1', metadata)).toBe('0x1');
  });

  it('passes body/DTO-typed params through unchanged, even if metatype is Number', () => {
    // Never actually happens for a whole DTO (its metatype is the DTO
    // class), but the `type` guard alone should already be enough to skip
    // anything that isn't a param or query.
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: Number,
    };

    expect(pipe.transform('0x1', metadata)).toBe('0x1');
  });

  it('passes a non-string value through unchanged (already coerced upstream)', () => {
    expect(pipe.transform(5, paramMetadata)).toBe(5);
  });
});
