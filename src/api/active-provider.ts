import type { DataProvider } from './data-provider'

let provider: DataProvider | null = null

export function setActiveDataProvider(p: DataProvider | null): void {
  provider = p
}

export function getActiveDataProvider(): DataProvider | null {
  return provider
}
