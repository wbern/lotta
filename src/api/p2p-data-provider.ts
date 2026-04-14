import type { DataProvider } from './data-provider'
import type { SetResultCommand } from './result-command'
import { createCommandDeps, handleSetResult } from './result-command'
import type { RpcRequest, RpcResponse } from './rpc'
import { createRpcClient, dispatch } from './rpc'

interface RpcSender {
  sendRpcRequest(request: RpcRequest): void
  onRpcResponse: ((response: RpcResponse) => void) | null
}

interface RpcReceiver {
  sendRpcResponse(response: RpcResponse, peerId: string): void
  onRpcRequest: ((request: RpcRequest, peerId: string) => void) | null
}

export function createP2pClientProvider(service: RpcSender): DataProvider {
  return createRpcClient(
    (req) => service.sendRpcRequest(req),
    (cb) => {
      service.onRpcResponse = cb
    },
  )
}

const READ_METHODS = new Set(['list', 'get'])

/** Per-method permission record. Only explicitly `true` methods are allowed. */
export type RpcPermissions = Partial<Record<string, boolean>>

const peerPermissions = new Map<string, RpcPermissions>()

export function setPeerPermissions(peerId: string, perms: RpcPermissions): void {
  peerPermissions.set(peerId, perms)
}

export function clearAllPeerPermissions(): void {
  peerPermissions.clear()
}

export function createFullPermissions(): RpcPermissions {
  return {
    'tournaments.list': true,
    'tournaments.get': true,
    'tournamentPlayers.list': true,
    'rounds.list': true,
    'rounds.get': true,
    'standings.get': true,
    'results.set': true,
    'commands.setResult': true,
  }
}

export function createViewPermissions(): RpcPermissions {
  return {
    'tournaments.list': true,
    'tournaments.get': true,
    'rounds.list': true,
    'rounds.get': true,
    'tournamentPlayers.list': true,
  }
}

interface RpcServerOptions {
  onMutation?: () => void
}

function isAllowed(method: string, peerId: string): boolean {
  const perms = peerPermissions.get(peerId)
  if (!perms) {
    // Fallback: if no per-peer permissions set, allow reads only
    const methodName = method.split('.')[1]
    return READ_METHODS.has(methodName)
  }
  return perms[method] === true
}

export function startP2pRpcServer(
  service: RpcReceiver,
  provider: DataProvider,
  options?: RpcServerOptions,
): void {
  const commandDeps = createCommandDeps(provider)

  service.onRpcRequest = async (req, peerId) => {
    try {
      if (!isAllowed(req.method, peerId)) {
        service.sendRpcResponse({ id: req.id, error: `Permission denied: ${req.method}` }, peerId)
        return
      }

      let result: unknown
      let isMutation = false
      if (req.method === 'commands.setResult') {
        const outcome = await handleSetResult(req.args[0] as SetResultCommand, commandDeps)
        result = outcome
        isMutation = outcome.status === 'applied'
      } else {
        result = await dispatch(provider, req.method, req.args)
        const methodName = req.method.split('.')[1]
        isMutation = !READ_METHODS.has(methodName)
      }
      service.sendRpcResponse({ id: req.id, result }, peerId)
      if (options?.onMutation && isMutation) {
        options.onMutation()
      }
    } catch (e) {
      service.sendRpcResponse(
        { id: req.id, error: e instanceof Error ? e.message : String(e) },
        peerId,
      )
    }
  }
}
