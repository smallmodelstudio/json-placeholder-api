import { describe, it, beforeEach, expect } from 'vitest';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ParsePositiveIntPipe } from './parse-positive-int.pipe';

describe('ParsePositiveIntPipe', () => {
  let pipe: ParsePositiveIntPipe;
  const metadata: ArgumentMetadata = {
    type: 'param',
    data: 'id',
  };

  beforeEach(() => {
    pipe = new ParsePositiveIntPipe();
  });

  it('parses a valid positive integer string', () => {
    expect(pipe.transform('1', metadata)).toBe(1);
    expect(pipe.transform('42', metadata)).toBe(42);
  });

  it.each(['0', '-1', '1.5', 'abc', '', ' '])(
    'rejects %p as not a positive integer',
    (value) => {
      expect(() => pipe.transform(value, metadata)).toThrow(
        BadRequestException,
      );
    },
  );

  it('includes the param name in the error message', () => {
    expect(() => pipe.transform('abc', metadata)).toThrow('id');
  });
});
