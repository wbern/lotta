import type { DataProviderSetup } from './data-provider'
import { createLocalProvider } from './local-data-provider'
import type { RpcRequest, RpcResponse } from './rpc'
import { createRpcClient, dispatch } from './rpc'

function startServer(port: MessagePort, provider: import('./data-provider').DataProvider): void {
  port.onmessage = async (event: MessageEvent<RpcRequest>) => {
    const { id, method, args } = event.data
    try {
      const result = await dispatch(provider, method, args)
      port.postMessage({ id, result } satisfies RpcResponse)
    } catch (e) {
      port.postMessage({
        id,
        error: e instanceof Error ? e.message : String(e),
      } satisfies RpcResponse)
    }
  }
}

export async function createRemoteProvider(): Promise<DataProviderSetup> {
  const local = await createLocalProvider()
  const channel = new MessageChannel()

  startServer(channel.port1, local.provider)

  const provider = createRpcClient(
    (req) => channel.port2.postMessage(req),
    (cb) => {
      channel.port2.onmessage = (event: MessageEvent<RpcResponse>) => cb(event.data)
    },
  )

  return {
    provider,
    teardown: async () => {
      channel.port1.close()
      channel.port2.close()
      await local.teardown()
    },
  }
}
