import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

function createMockEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/heartbeat',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    ...overrides,
  };
}

describe('heartbeat handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns 200 status code', async () => {
    const { handler } = await import('../../src/functions/heartbeat.js');
    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
  });

  it('includes CORS headers', async () => {
    const { handler } = await import('../../src/functions/heartbeat.js');
    const result = await handler(createMockEvent());

    expect(result.headers).toMatchObject({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    });
  });

  it('returns 500 when service throws', async () => {
    vi.doMock('../../src/services/heartbeat.service.js', () => ({
      getHeartbeat: () => {
        throw new Error('boom');
      },
    }));

    const { handler } = await import('../../src/functions/heartbeat.js');
    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
    });
  });
});
