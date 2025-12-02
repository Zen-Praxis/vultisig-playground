export interface Utxo {
  index: number
  hash: string
  value: bigint
}

export interface UtxoStatus {
  confirmed: boolean
  block_height: number
  block_hash: string
  block_time: number
}

export interface UtxoResponse {
  txid: string
  vout: number
  status: UtxoStatus
  value: number
}

export class UtxoContext {
  private static readonly BASE_ENDPOINTS = [
    'https://mempool.space/api',
    'https://blockstream.info/api',
  ]

  private get addressEndpoints(): string[] {
    return UtxoContext.BASE_ENDPOINTS.map(base => `${base}/address`)
  }

  constructor(private address: string) {}

  public async fetchUtxos(): Promise<Utxo[]> {
    return Promise.race(this.addressEndpoints.map((x) => this.fetch(x)))
  }

  public async fetch(endpoint: string): Promise<Utxo[]> {
    const res = await fetch(`${endpoint}/${this.address}/utxo`)
    const json: UtxoResponse[] = await res.json()

    return json.map((x) => ({
      index: x.vout,
      hash: x.txid,
      value: BigInt(x.value),
    }))
  }

  public async fetchTransaction(txid: string): Promise<string> {
    const endpoints = UtxoContext.BASE_ENDPOINTS.map(base => `${base}/tx`)

    const responses = await Promise.allSettled(
      endpoints.map(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/${txid}/hex`)
        if (!res.ok) throw new Error(`Failed to fetch tx from ${baseUrl}`)
        return await res.text()
      })
    )

    const successful = responses.find((r) => r.status === 'fulfilled')
    if (!successful || successful.status !== 'fulfilled') {
      throw new Error('Failed to fetch transaction hex from all endpoints')
    }

    return successful.value
  }

  public static async fetchRecommendedFeeRate(): Promise<bigint> {
    const endpoints = [
      { url: `${UtxoContext.BASE_ENDPOINTS[0]}/v1/fees/recommended`, getFee: (data: { fastestFee: number }) => BigInt(data.fastestFee) },
      { url: `${UtxoContext.BASE_ENDPOINTS[1]}/fee-estimates`, getFee: (data: Record<string, number>) => {
        const target = '6'
        const fee = data[target]
        if (!fee) {
          const values = Object.values(data).filter((v): v is number => typeof v === 'number')
          return BigInt(Math.ceil(values[0] || 10))
        }
        return BigInt(Math.ceil(fee))
      }},
    ]

    const responses = await Promise.allSettled(
      endpoints.map(async ({ url, getFee }) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch fee from ${url}`)
        const data = await res.json()
        return getFee(data)
      })
    )

    const successful = responses.find((r) => r.status === 'fulfilled')
    if (!successful || successful.status !== 'fulfilled') {
      return BigInt(10)
    }

    return successful.value
  }

  public static async broadcastTransaction(txHex: string): Promise<string> {
    const endpoints = UtxoContext.BASE_ENDPOINTS.map(base => `${base}/tx`)

    const responses = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: txHex,
        })
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Failed to broadcast: ${errorText}`)
        }
        return await res.text()
      })
    )

    const successful = responses.find((r) => r.status === 'fulfilled')
    if (!successful || successful.status !== 'fulfilled') {
      const errors = responses
        .filter((r) => r.status === 'rejected')
        .map((r) => (r.status === 'rejected' ? r.reason?.message || 'Unknown error' : ''))
        .join(', ')
      throw new Error(`Failed to broadcast to all endpoints: ${errors}`)
    }

    return successful.value
  }
}

