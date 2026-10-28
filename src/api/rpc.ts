import type { DataProvider } from './data-provider'

export interface RpcRequest {
  id: number
  method: string
  args: unknown[]
}

export interface RpcResponse {
  id: number
  result?: unknown
  error?: string
}

/** The host refused an RPC because the connected arbiter lacks the permission. */
export class PermissionDeniedError extends Error {
  readonly method: string
  constructor(method: string) {
    super('Värden tillåter inte den här åtgärden för anslutna domare.')
    this.method = method
    this.name = 'PermissionDeniedError'
  }
}

const PERMISSION_DENIED_PREFIX = 'Permission denied:'

export async function dispatch(
  provider: DataProvider,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const [domain, fn] = method.split('.')
  if (!Object.hasOwn(provider, domain)) {
    throw new Error(`Unknown method: ${method}`)
  }
  const target = provider[domain as keyof DataProvider] as Record<string, unknown>
  if (!Object.hasOwn(target, fn) || typeof target[fn] !== 'function') {
    throw new Error(`Unknown method: ${method}`)
  }
  return (target[fn] as (...a: unknown[]) => unknown)(...args)
}

export function createRpcClient(
  send: (req: RpcRequest) => void,
  onReceive: (cb: (res: RpcResponse) => void) => void,
): DataProvider {
  let nextId = 1
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  onReceive((res: RpcResponse) => {
    const handler = pending.get(res.id)
    if (!handler) return
    pending.delete(res.id)
    if (res.error?.startsWith(PERMISSION_DENIED_PREFIX)) {
      handler.reject(
        new PermissionDeniedError(res.error.slice(PERMISSION_DENIED_PREFIX.length).trim()),
      )
    } else if (res.error) {
      handler.reject(new Error(res.error))
    } else {
      handler.resolve(res.result)
    }
  })

  function call(method: string, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      send({ id, method, args })
    })
  }

  return new Proxy({} as DataProvider, {
    get(_target, domain: string) {
      return new Proxy(
        {},
        {
          get(_t, method: string) {
            return (...args: unknown[]) => call(`${domain}.${method}`, ...args)
          },
        },
      )
    },
  })
}
