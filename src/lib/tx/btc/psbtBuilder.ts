import * as bitcoin from '@shapeshiftoss/bitcoinjs-lib'
import { Buffer } from 'buffer'
import { UtxoContext, Utxo } from './UtxoContext'

export interface PsbtInputConfig {
  txid: string
  vout: number
  hex: string
}

export interface PsbtOutputConfig {
  address: string
  amount: bigint
}

export interface PsbtConfig {
  inputs: PsbtInputConfig[]
  outputs: PsbtOutputConfig[]
  version?: number
  locktime?: number
  opReturnData?: string
}

export class PsbtBuilder {
  private network: bitcoin.networks.Network

  constructor(network: bitcoin.networks.Network = bitcoin.networks.bitcoin) {
    console.log('PsbtBuilder constructor', network)
    this.network = network
  }

  public async buildPsbt(config: PsbtConfig): Promise<bitcoin.Psbt> {
    const psbt = new bitcoin.Psbt({ network: this.network })

    psbt.setVersion(config.version ?? 2)
    if (config.locktime && config.locktime > 0) {
      psbt.setLocktime(config.locktime)
    }

    for (const input of config.inputs) {
      if (!input.txid || !input.hex) {
        throw new Error('All inputs must have txid and hex')
      }

      psbt.addInput({
        hash: input.txid, 
        index: input.vout,
        nonWitnessUtxo: Buffer.from(input.hex, 'hex'),
      })
    }

    for (const output of config.outputs) {
      if (!output.address || output.amount === undefined) {
        throw new Error('All outputs must have address and amount')
      }

      psbt.addOutput({
        address: output.address,
        value: output.amount,
      })
    }

    if (config.opReturnData?.trim()) {
      const data = Buffer.from(config.opReturnData, 'utf-8')
      const embed = bitcoin.payments.embed({ data: [data] })
      const script = embed.output
      if (!script) {
        throw new Error('Unable to build OP_RETURN script')
      }
      psbt.addOutput({ script, value: BigInt(0) })
    }

    return psbt
  }

  public async buildPsbtFromUtxos(
    utxos: Utxo[],
    fromAddress: string,
    toAddress: string,
    amount: bigint,
    feeRate: bigint = BigInt(10),
    opReturnData?: string
  ): Promise<{ psbt: bitcoin.Psbt; selectedUtxos: Utxo[] }> {
    const utxoContext = new UtxoContext(fromAddress)

    const selectedUtxos = this.selectUtxos(utxos, amount, feeRate)
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, BigInt(0))

    const estimatedFee = this.estimateFee(selectedUtxos.length, 2, feeRate)
    const change = totalInput - amount - estimatedFee

    const outputs: PsbtOutputConfig[] = [
      { address: toAddress, amount },
    ]

    if (change > BigInt(0)) {
      outputs.push({ address: fromAddress, amount: change })
    }

    const inputs: PsbtInputConfig[] = await Promise.all(
      selectedUtxos.map(async (utxo) => {
        const hex = await utxoContext.fetchTransaction(utxo.hash)
        return {
          txid: utxo.hash,
          vout: utxo.index,
          hex,
        }
      })
    )

    const psbt = await this.buildPsbt({
      inputs,
      outputs,
      opReturnData,
    })

    return { psbt, selectedUtxos }
  }

  private selectUtxos(utxos: Utxo[], amount: bigint, feeRate: bigint): Utxo[] {
    const sortedUtxos = [...utxos].sort((a, b) => {
      if (a.value < b.value) return -1
      if (a.value > b.value) return 1
      return 0
    })

    let total = BigInt(0)
    const selected: Utxo[] = []

    for (const utxo of sortedUtxos) {
      selected.push(utxo)
      total += utxo.value

      const estimatedFee = this.estimateFee(selected.length, 2, feeRate)
      if (total >= amount + estimatedFee) {
        break
      }
    }

    const finalEstimatedFee = this.estimateFee(selected.length, 2, feeRate)
    if (total < amount + finalEstimatedFee) {
      throw new Error('Insufficient funds to cover amount and fees')
    }

    return selected
  }

  private estimateFee(inputCount: number, outputCount: number, feeRate: bigint): bigint {
    const baseTxSize = 10
    const inputSize = 148
    const outputSize = 34
    const totalSize = baseTxSize + inputCount * inputSize + outputCount * outputSize
    return BigInt(totalSize) * feeRate
  }
}

