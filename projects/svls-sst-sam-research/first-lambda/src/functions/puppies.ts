import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPuppies } from '../services/puppies.service.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

export async function handler(
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = getPuppies();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error('Puppy list error:', error);

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
