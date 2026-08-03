/**
 * Shared error handling utilities for all Base44 serverless functions.
 */

export interface LogEntry {
  timestamp: string;
  function: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  request_id?: string;
  context?: Record<string, unknown>;
}

function log(entry: LogEntry) {
  console[entry.level === "ERROR" ? "error" : entry.level === "WARN" ? "warn" : "log"](
    JSON.stringify(entry)
  );
}

/**
 * Retry a function up to maxAttempts times with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

/**
 * Higher-order wrapper: catches all errors, logs them, returns a standardised
 * error response. The wrapped handler must return a Response.
 */
export function withErrorHandling(
  fnName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const request_id = crypto.randomUUID();
    log({ timestamp: new Date().toISOString(), function: fnName, level: "INFO", message: "Request received", request_id });
    try {
      const response = await handler(req);
      log({ timestamp: new Date().toISOString(), function: fnName, level: "INFO", message: `Response ${response.status}`, request_id });
      return response;
    } catch (err) {
      const error = err as Error;
      log({ timestamp: new Date().toISOString(), function: fnName, level: "ERROR", message: error.message, request_id, context: { stack: error.stack } });
      return Response.json({ error: error.message, request_id }, { status: 500 });
    }
  };
}

export { log };
