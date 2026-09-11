import { afterEach, beforeAll, afterAll } from 'vitest';
import nock from 'nock';

beforeAll(() => {
  // Allow supertest's own loopback calls to the app; block everything else.
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});
