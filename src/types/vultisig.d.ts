export interface VultisigProvider {
  request(params: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: string, handler: (data?: unknown) => void): void
  removeListener(event: string, handler: (data?: unknown) => void): void
}

export interface VultisigVault {
  name?: string
  [key: string]: unknown
}

interface VultisigWindow {
  vultisig?: {
    bitcoin?: VultisigProvider
    getVault(): Promise<VultisigVault>
    [key: string]: unknown
  }
}

declare global {
  interface Window extends VultisigWindow {}
}

