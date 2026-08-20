import nock from 'nock';

const UPSTREAM_BASE_URL =
  process.env.UPSTREAM_BASE_URL ?? 'https://jsonplaceholder.typicode.com';

export function mockUpstream(): nock.Scope {
  return nock(UPSTREAM_BASE_URL);
}
