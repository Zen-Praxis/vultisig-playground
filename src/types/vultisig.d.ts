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
    cosmos?: VultisigProvider
    keplr?: VultisigProvider
    ethereum?: VultisigProvider
    tron?: VultisigProvider
    zcash?: VultisigProvider
    dogecoin?: VultisigProvider
    bch?: VultisigProvider
    litecoin?: VultisigProvider
    thorchain?: VultisigProvider
    mayachain?: VultisigProvider
    ripple?: VultisigProvider
    solana?: VultisigProvider
    polkadot?: VultisigProvider
    dash?: VultisigProvider
    getVault(): Promise<VultisigVault>
    [key: string]: unknown
  }
  phantom?: {
    bitcoin?: VultisigProvider & {
      signPSBT?: (
        psbt: Buffer,
        options: { inputsToSign: Array<{ address: string; signingIndexes: number[]; sigHash: number }> },
        finalize: boolean
      ) => Promise<Buffer>
    }
  }
}

declare global {
  interface Window extends VultisigWindow {}
}

