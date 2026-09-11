import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';

interface ApiEnvelopedResponseOptions {
  status?: number;
  isArray?: boolean;
  description?: string;
}

const metaSchema: SchemaObject = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    // Not always a UUID: it's either an OTel trace id (32 lowercase hex
    // characters) or whatever a client's own x-correlation-id header
    // supplied, within isValidCorrelationId()'s bounds — see
    // correlation-id.hook.ts.
    correlationId: { type: 'string' },
  },
  required: ['timestamp', 'correlationId'],
};

// Every success response is wrapped by TransformInterceptor into
// { data, meta }, so documenting a bare data shape anywhere would be wrong.
// Exported so the one route whose data shape isn't a reusable entity class
// (HealthController, wrapping terminus's HealthCheckResult) can still get an
// accurate envelope without needing ApiExtraModels/getSchemaPath.
export const envelopeSchema = (
  dataSchema: SchemaObject | ReferenceObject,
): SchemaObject => ({
  properties: {
    data: dataSchema,
    meta: metaSchema,
  },
  required: ['data', 'meta'],
});

export const ApiEnvelopedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  {
    status = 200,
    isArray = false,
    description,
  }: ApiEnvelopedResponseOptions = {},
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      ...(description !== undefined && { description }),
      schema: envelopeSchema(
        isArray
          ? { type: 'array', items: { $ref: getSchemaPath(model) } }
          : { $ref: getSchemaPath(model) },
      ),
    }),
  );

// For the DELETE endpoints: JSONPlaceholder always responds 200 {} rather
// than 204, so there's no entity class to wrap — just document the envelope
// around an empty object.
export const ApiEnvelopedEmptyResponse = (description?: string) =>
  ApiResponse({
    status: 200,
    ...(description !== undefined && { description }),
    schema: envelopeSchema({ type: 'object' }),
  });

// The shape AllExceptionsFilter sends for every error response, success
// envelope's opposite number.
export const errorEnvelopeSchema: SchemaObject = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    error: { type: 'string' },
    path: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    correlationId: { type: 'string' },
  },
  required: [
    'statusCode',
    'message',
    'error',
    'path',
    'timestamp',
    'correlationId',
  ],
};

// The error responses every resource controller's routes can produce, given
// AllExceptionsFilter's mapping (see docs/README-architecture.md) — a class
// decorator on each so every method inherits them without repeating the
// same five ApiResponse calls per route. Health and its own 503 are
// documented separately (health.controller.ts): its failure path doesn't go
// through UpstreamService, so this set doesn't apply there.
export const ApiCommonErrorResponses = () =>
  applyDecorators(
    ApiResponse({
      status: 400,
      description: 'A path/query param or request body failed validation.',
      schema: errorEnvelopeSchema,
    }),
    ApiResponse({
      status: 404,
      description: 'The requested resource does not exist upstream.',
      schema: errorEnvelopeSchema,
    }),
    ApiResponse({
      status: 429,
      description: 'Too many requests from this client.',
      schema: errorEnvelopeSchema,
    }),
    ApiResponse({
      status: 502,
      description:
        'The upstream service returned an error, or an invalid response.',
      schema: errorEnvelopeSchema,
    }),
    ApiResponse({
      status: 504,
      description: 'The upstream service did not respond in time.',
      schema: errorEnvelopeSchema,
    }),
  );
