export interface BffErrorResponse {
  success: false;
  data?: never;
  error: string;
  code?: string;
}

export function bffError(message: string, code?: string): BffErrorResponse {
  return { success: false, error: message, code };
}