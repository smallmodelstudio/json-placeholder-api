import { z } from 'zod';

export const nonEmptyString = z.string().min(1);

// Body values arrive as real JSON numbers, so no string coercion.
export const positiveIntBody = z.number().int().positive();

// Query values arrive as strings. Only ASCII decimal digits, no leading
// zero and no sign — same shape ParsePositiveIntPipe enforces for :id
// params, and stricter than z.coerce.number(), which also accepts hex and
// exponential notation.
export const positiveIntQuery = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number);

export const httpUrl = z.url({ protocol: /^https?$/ });

export const email = z.email();

// -37.3159, not -37.3159e1 or similar — Number() alone is as permissive
// here as it is for positiveIntQuery, so the regex runs first.
const DECIMAL = /^-?\d+(\.\d+)?$/;

function decimalStringInRange(min: number, max: number) {
  return z
    .string()
    .regex(DECIMAL)
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= min && parsed <= max;
    }, `must be between ${min} and ${max}`);
}

export const latitudeString = decimalStringInRange(-90, 90);
export const longitudeString = decimalStringInRange(-180, 180);
