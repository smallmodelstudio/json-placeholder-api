import { describe, it, expect } from 'vitest';
import {
  nonEmptyString,
  positiveIntBody,
  positiveIntQuery,
  httpUrl,
  email,
  latitudeString,
  longitudeString,
} from './fields';

describe('nonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(nonEmptyString.safeParse('hello').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(nonEmptyString.safeParse('').success).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(nonEmptyString.safeParse(1).success).toBe(false);
  });
});

describe('positiveIntBody', () => {
  it('accepts a positive integer', () => {
    expect(positiveIntBody.safeParse(1).success).toBe(true);
  });

  it.each(['1', 1.5, 0, -1])('rejects %p', (value) => {
    expect(positiveIntBody.safeParse(value).success).toBe(false);
  });
});

describe('positiveIntQuery', () => {
  it('parses a valid positive integer string to a number', () => {
    const result = positiveIntQuery.safeParse('1');
    expect(result).toMatchObject({ success: true, data: 1 });
  });

  it.each(['0x1', '1e2', '', ' 1', '-1', '0', '01'])('rejects %p', (value) => {
    expect(positiveIntQuery.safeParse(value).success).toBe(false);
  });
});

describe('httpUrl', () => {
  it.each(['http://example.com', 'https://example.com/a.png'])(
    'accepts %p',
    (value) => {
      expect(httpUrl.safeParse(value).success).toBe(true);
    },
  );

  it.each(['example.com/a.png', 'ftp://example.com'])('rejects %p', (value) => {
    expect(httpUrl.safeParse(value).success).toBe(false);
  });
});

describe('email', () => {
  it('accepts a valid email', () => {
    expect(email.safeParse('a@example.com').success).toBe(true);
  });

  it('rejects a non-email string', () => {
    expect(email.safeParse('not-an-email').success).toBe(false);
  });
});

describe('latitudeString', () => {
  it.each(['0', '90', '-90', '45.123'])('accepts %p', (value) => {
    expect(latitudeString.safeParse(value).success).toBe(true);
  });

  it.each(['90.0001', '-90.0001', 'abc'])('rejects %p', (value) => {
    expect(latitudeString.safeParse(value).success).toBe(false);
  });
});

describe('longitudeString', () => {
  it.each(['0', '180', '-180', '45.123'])('accepts %p', (value) => {
    expect(longitudeString.safeParse(value).success).toBe(true);
  });

  it.each(['180.0001', '-180.0001', 'abc'])('rejects %p', (value) => {
    expect(longitudeString.safeParse(value).success).toBe(false);
  });
});
