export interface HeartbeatResponse {
  status: string;
  timestamp: string;
  version: string;
}

export function getHeartbeat(): HeartbeatResponse {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION || '0.0.0',
  };
}
