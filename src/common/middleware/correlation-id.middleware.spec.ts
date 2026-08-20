import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    next = jest.fn();
  });

  const makeReq = (header?: string): Request =>
    ({ header: jest.fn().mockReturnValue(header) }) as unknown as Request;

  const makeRes = (): { res: Response; setHeader: jest.Mock } => {
    const setHeader = jest.fn();
    return { res: { setHeader } as unknown as Response, setHeader };
  };

  it('generates a correlation id when none is supplied', () => {
    const req = makeReq(undefined);
    const { res, setHeader } = makeRes();

    middleware.use(req, res, next);

    expect(req.correlationId).toEqual(expect.any(String));
    expect(req.correlationId.length).toBeGreaterThan(0);
    expect(setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      req.correlationId,
    );
    expect(next).toHaveBeenCalled();
  });

  it('reuses an incoming correlation id header', () => {
    const req = makeReq('incoming-id-123');
    const { res, setHeader } = makeRes();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('incoming-id-123');
    expect(setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'incoming-id-123',
    );
  });

  it('ignores a blank incoming header and generates a new id', () => {
    const req = makeReq('   ');
    const { res } = makeRes();

    middleware.use(req, res, next);

    expect(req.correlationId).not.toBe('   ');
    expect(req.correlationId.trim().length).toBeGreaterThan(0);
  });
});
