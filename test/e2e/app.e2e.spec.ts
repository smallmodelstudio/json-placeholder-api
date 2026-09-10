import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../support/create-test-app';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('bootstraps successfully', () => {
    expect(app).toBeDefined();
  });
});
