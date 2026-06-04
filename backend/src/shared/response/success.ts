export interface BffDataResponse<T> {
  success: true;
  data: T;
  error?: never;
  message?: never;
}

export function bffData<T>(data: T): BffDataResponse<T> {
  return { success: true, data };
}