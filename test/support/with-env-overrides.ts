export async function withEnvOverrides<T>(
  overrides: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}
