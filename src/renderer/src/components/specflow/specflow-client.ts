import type { SpecflowHttpMethod } from '../../../../shared/specflow-types'

export class SpecflowRequestError extends Error {
  readonly status: number | null

  constructor(status: number | null, message: string) {
    super(message)
    this.name = 'SpecflowRequestError'
    this.status = status
  }
}

/** Authenticated SpecFlow JSON call; throws SpecflowRequestError on failure. */
export async function specflowRequest<T>(
  method: SpecflowHttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const result = await window.api.specflow.request<T>({ method, path, body })
  if (!result.ok) {
    throw new SpecflowRequestError(result.status, result.error)
  }
  return result.data
}
