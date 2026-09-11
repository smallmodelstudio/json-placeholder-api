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
    correlationId: { type: 'string', format: 'uuid' },
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
// envelope's opposite number. Not used on every route's Swagger docs today
// (see docs/README-architecture.md's note on undocumented error responses)
// — currently only HealthController's 503, whose body would otherwise be
// undocumented since it doesn't come from throwing one of this app's own,
// already-`{message,error}`-shaped exceptions.
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
