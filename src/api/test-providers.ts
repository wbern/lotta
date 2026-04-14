import type { DataProviderSetup } from './data-provider'
import { createLocalProvider } from './local-data-provider'
import { createRemoteProvider } from './remote-data-provider'

export const PROVIDERS: [string, () => Promise<DataProviderSetup>][] = [
  ['local', createLocalProvider],
  ['remote', createRemoteProvider],
]
