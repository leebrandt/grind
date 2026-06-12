import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getHeartbeat } from '../services/heartbeat.service.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

export async function handler(
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = getHeartbeat();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error('Heartbeat error:', error);

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
