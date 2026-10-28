import { describe, expect, it } from 'vitest'
import type { DataProvider } from './data-provider'
import { createRpcClient, dispatch, PermissionDeniedError, type RpcResponse } from './rpc'

describe('dispatch', () => {
  it('rejects prototype-chain method lookups', async () => {
    const provider = {} as DataProvider
    await expect(dispatch(provider, 'constructor.name', [])).rejects.toThrow(
      'Unknown method: constructor.name',
    )
    await expect(dispatch(provider, 'toString.call', [])).rejects.toThrow(
      'Unknown method: toString.call',
    )
  })
})

describe('createRpcClient', () => {
  function clientWithResponse(error: string) {
    let deliver: (res: RpcResponse) => void = () => {}
    const client = createRpcClient(
      (req) => queueMicrotask(() => deliver({ id: req.id, error })),
      (cb) => {
        deliver = cb
      },
    )
    return client
  }

  it('given the host refuses a method for connected arbiters, when the call is made, then the rejection explains it in Swedish', async () => {
    const client = clientWithResponse('Permission denied: tournaments.create')

    const call = client.tournaments.list()

    await expect(call).rejects.toThrow('Värden tillåter inte den här åtgärden för anslutna domare.')
    await expect(call).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('given any other host error, when the call is made, then its message is passed through unchanged', async () => {
    const client = clientWithResponse('Alla matcher måste ha resultat innan ny rond kan lottas!')

    await expect(client.rounds.pairNext(1)).rejects.toThrow(
      'Alla matcher måste ha resultat innan ny rond kan lottas!',
    )
  })
})
