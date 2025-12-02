import { useState, useEffect } from 'react'
import { Buffer } from 'buffer'
import * as bitcoin from '@shapeshiftoss/bitcoinjs-lib'
import { UtxoContext, Utxo } from '../../lib/tx/btc/UtxoContext'
import { PsbtBuilder } from '../../lib/tx/btc/psbtBuilder'

interface SignPsbtMethodProps {
  provider: unknown
  onResult: (result: unknown) => void
  onError: (error: string) => void
  onAccountUpdate?: (accounts: string[]) => void
}

export function SignPsbtMethod({ onResult, onError }: SignPsbtMethodProps) {
  const [mode, setMode] = useState<'generate' | 'sign'>('generate')
  const [psbt, setPsbt] = useState<string>('')
  const [psbtInstance, setPsbtInstance] = useState<bitcoin.Psbt | null>(null)
  const [selectedUtxosForPsbt, setSelectedUtxosForPsbt] = useState<Utxo[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingPhantom, setLoadingPhantom] = useState<boolean>(false)
  const [broadcasting, setBroadcasting] = useState<boolean>(false)
  const [txid, setTxid] = useState<string>('')

  const [fromAddress, setFromAddress] = useState<string>('bc1qf6sqcalymxg79z76sm2700m0c0f4fazlw7j0xp')
  const [toAddress, setToAddress] = useState<string>('bc1qf6sqcalymxg79z76sm2700m0c0f4fazlw7j0xp')
  const [amount, setAmount] = useState<string>('')
  const [feeRate, setFeeRate] = useState<string>('')
  const [opReturnData, setOpReturnData] = useState<string>('')
  
  const [utxos, setUtxos] = useState<Utxo[]>([])
  const [selectedUtxos, setSelectedUtxos] = useState<Set<string>>(new Set())
  const [loadingUtxos, setLoadingUtxos] = useState<boolean>(false)
  const [loadingFeeRate, setLoadingFeeRate] = useState<boolean>(false)
  const [connectedAddress, setConnectedAddress] = useState<string>('')

  useEffect(() => {
    const fetchConnectedAddress = async (): Promise<void> => {
      if (!window.vultisig?.bitcoin) return

      try {
        const providerObj = window.vultisig.bitcoin as unknown as Record<string, unknown>
        if (providerObj.request) {
          const accounts = await (providerObj.request as (params: { method: string }) => Promise<string[]>)({
            method: 'get_accounts'
          })
          if (accounts && accounts.length > 0) {
            setConnectedAddress(accounts[0])
            setFromAddress(accounts[0])
          }
        }
      } catch (err) {
        // Silent fail
      }
    }

    fetchConnectedAddress()
  }, [])

  const handleFetchFeeRate = async (): Promise<void> => {
    setLoadingFeeRate(true)
    try {
      const recommendedFee = await UtxoContext.fetchRecommendedFeeRate()
      setFeeRate(recommendedFee.toString())
    } catch (err) {
      onError((err as Error).message || 'Failed to fetch recommended fee rate')
    } finally {
      setLoadingFeeRate(false)
    }
  }

  const handleFetchUtxos = async (): Promise<void> => {
    if (!fromAddress.trim()) {
      onError('From address is required')
      return
    }

    setLoadingUtxos(true)
    try {
      const utxoContext = new UtxoContext(fromAddress)
      const fetchedUtxos = await utxoContext.fetchUtxos()
      setUtxos(fetchedUtxos)
      setSelectedUtxos(new Set())
    } catch (err) {
      onError((err as Error).message || 'Failed to fetch UTXOs')
      setUtxos([])
      setSelectedUtxos(new Set())
    } finally {
      setLoadingUtxos(false)
    }
  }

  const handleToggleUtxo = (utxo: Utxo): void => {
    const utxoKey = `${utxo.hash}:${utxo.index}`
    const newSelected = new Set(selectedUtxos)
    if (newSelected.has(utxoKey)) {
      newSelected.delete(utxoKey)
    } else {
      newSelected.add(utxoKey)
    }
    setSelectedUtxos(newSelected)
  }

  const handleGeneratePsbt = async (): Promise<void> => {
    if (!fromAddress.trim() || !toAddress.trim() || !amount.trim()) {
      onError('From address, to address, and amount are required')
      return
    }

    const amountFloat = parseFloat(amount)
    if (isNaN(amountFloat) || amountFloat <= 0) {
      onError('Amount must be greater than 0')
      return
    }

    const amountBigInt = BigInt(Math.round(amountFloat * 100000000))

    setLoading(true)
    try {
      const builder = new PsbtBuilder()
      
      let utxosToUse: Utxo[]
      if (selectedUtxos.size > 0) {
        utxosToUse = utxos.filter((utxo) => selectedUtxos.has(`${utxo.hash}:${utxo.index}`))
      } else {
        utxosToUse = utxos
      }

      if (utxosToUse.length === 0) {
        onError('No UTXOs available for this address.')
        return
      }

      let feeRateBigInt: bigint
      if (feeRate.trim()) {
        feeRateBigInt = BigInt(feeRate)
      } else {
        feeRateBigInt = await UtxoContext.fetchRecommendedFeeRate()
      }
      
      const { psbt: psbtObj, selectedUtxos: utxosForPsbt } = await builder.buildPsbtFromUtxos(
        utxosToUse,
        fromAddress,
        toAddress,
        amountBigInt,
        feeRateBigInt,
        opReturnData.trim() || undefined
      )

      const psbtBase64 = psbtObj.toBase64()
      setPsbt(psbtBase64)
      setPsbtInstance(psbtObj)
      setSelectedUtxosForPsbt(utxosForPsbt)
      setMode('sign')
      onResult({ generated: psbtBase64 })
    } catch (err) {
      onError((err as Error).message || 'Failed to generate PSBT')
    } finally {
      setLoading(false)
    }
  }

  const handleSignPsbt = async (): Promise<void> => {
    if (!window.vultisig?.bitcoin) {
      onError('Provider not available')
      return
    }

    if (!psbt.trim()) {
      onError('PSBT is required')
      return
    }

    setLoading(true)
    try {
      const providerObj = window.vultisig.bitcoin as unknown as Record<string, unknown>

      if (!providerObj.signPSBT || typeof providerObj.signPSBT !== 'function') {
        throw new Error('Sign PSBT method not available')
      }

      // Usar la instancia original si está disponible, sino reconstruir desde base64
      let currentPsbtInstance = psbtInstance
      if (!currentPsbtInstance) {
        const psbtBuffer = Buffer.from(psbt, 'base64')
        currentPsbtInstance = bitcoin.Psbt.fromBuffer(psbtBuffer)
      }

      const psbtBuffer = currentPsbtInstance.toBuffer()
      
      // Buscar el UTXO original correspondiente a cada input del PSBT
      const inputsToSign = currentPsbtInstance.data.inputs.map((_, psbtIndex) => {
        // Obtener el hash y el index del input del PSBT
        const txInput = currentPsbtInstance.txInputs[psbtIndex]
        const inputHash = Buffer.from(txInput.hash).toString('hex')
        const inputIndex = txInput.index
        
        // Buscar el UTXO original usando el hash y el index
        const utxo = selectedUtxosForPsbt.find(
          (u) => u.hash === inputHash && u.index === inputIndex
        )
        // Usar el índice original del UTXO si se encuentra, sino usar el índice del PSBT
        const signingIndex = utxo ? utxo.index : psbtIndex
        
        return {
          address: fromAddress,
          signingIndexes: [signingIndex],
          sigHash: bitcoin.Transaction.SIGHASH_ALL
        }
      })

      // Firmar el PSBT sin finalizar (finalize = false)
      const signedPsbtBuffer = await (providerObj.signPSBT as (
        psbt:  Uint8Array<ArrayBufferLike>,
        options: { inputsToSign: Array<{ address: string; signingIndexes: number[]; sigHash: number }> },
        finalize?: boolean
      ) => Promise<Buffer>)(psbtBuffer, { inputsToSign }, false)
      
      const signedPsbtBase64 = signedPsbtBuffer.toString('base64')
      
      // Actualizar la instancia con el PSBT firmado
      const signedPsbtInstance = bitcoin.Psbt.fromBuffer(signedPsbtBuffer, { network: bitcoin.networks.bitcoin })
      
      for (let i = 0; i < signedPsbtInstance.inputCount; i++) {
        const input = signedPsbtInstance.data.inputs[i]
        if (!input.partialSig || input.partialSig.length === 0) {
          throw new Error(`Input #${i} is not signed. Please sign the PSBT first.`)
        }
      }
      
      setPsbt(signedPsbtBase64)
      setPsbtInstance(signedPsbtInstance)
      
      // Finalizar y broadcastear directamente después de firmar
      setBroadcasting(true)
      try {
        // Crear una copia para finalizar
        const finalizedPsbt = bitcoin.Psbt.fromBuffer(signedPsbtInstance.toBuffer(), { network: bitcoin.networks.bitcoin })
        
        try {
          finalizedPsbt.finalizeAllInputs()
        } catch (finalizeError) {
          for (let i = 0; i < finalizedPsbt.inputCount; i++) {
            try {
              finalizedPsbt.finalizeInput(i)
            } catch (inputError) {
              throw new Error(`Cannot finalize input #${i}: ${(inputError as Error).message}. Make sure the PSBT is fully signed.`)
            }
          }
        }

        const tx = finalizedPsbt.extractTransaction()
        const txHex = tx.toHex()

        // Broadcastear usando el contexto
        await UtxoContext.broadcastTransaction(txHex)

        const txid = tx.getId()
        setTxid(txid)
        onResult({ signedPsbt: signedPsbtBase64, broadcasted: true, txid })
      } catch (broadcastErr) {
        // Si el broadcast falla, aún reportamos que se firmó correctamente
        onResult({ signedPsbt: signedPsbtBase64 })
        onError(`Broadcast failed: ${(broadcastErr as Error).message || 'Unknown error'}`)
      } finally {
        setBroadcasting(false)
        setLoading(false)
      }
    } catch (err) {
      onError((err as Error).message || 'Unknown error')
      setLoading(false)
      setBroadcasting(false)
    }
  }

  const handleSignPsbtWithPhantom = async (): Promise<void> => {
    if (!window.phantom?.bitcoin) {
      onError('Phantom extension not detected')
      return
    }

    if (!psbt.trim()) {
      onError('PSBT is required')
      return
    }

    setLoadingPhantom(true)
    try {
      const providerObj = window.phantom.bitcoin as unknown as Record<string, unknown>

      if (!providerObj.signPSBT || typeof providerObj.signPSBT !== 'function') {
        throw new Error('Phantom Sign PSBT method not available')
      }

      // Usar la instancia original si está disponible, sino reconstruir desde base64
      let currentPsbtInstance = psbtInstance
      if (!currentPsbtInstance) {
        const psbtBuffer = Buffer.from(psbt, 'base64')
        currentPsbtInstance = bitcoin.Psbt.fromBuffer(psbtBuffer)
      }

      const psbtBuffer = currentPsbtInstance.toBuffer()
      
      // Buscar el UTXO original correspondiente a cada input del PSBT
      const inputsToSign = currentPsbtInstance.data.inputs.map((_, psbtIndex) => {
        // Obtener el hash y el index del input del PSBT
        const txInput = currentPsbtInstance.txInputs[psbtIndex]
        const inputHash = Buffer.from(txInput.hash).toString('hex')
        const inputIndex = txInput.index
        
        // Buscar el UTXO original usando el hash y el index
        const utxo = selectedUtxosForPsbt.find(
          (u) => u.hash === inputHash && u.index === inputIndex
        )
        // Usar el índice original del UTXO si se encuentra, sino usar el índice del PSBT
        const signingIndex = utxo ? utxo.index : psbtIndex
        
        return {
          address: fromAddress,
          signingIndexes: [signingIndex],
          sigHash: bitcoin.Transaction.SIGHASH_ALL
        }
      })

      // Phantom espera Buffer, igual que Vultisig
      const signedPsbtBuffer = await (providerObj.signPSBT as (
        psbt: Uint8Array<ArrayBufferLike>,
        options: { inputsToSign: Array<{ address: string; signingIndexes: number[]; sigHash: number }> },
        finalize: boolean
      ) => Promise<Buffer>)(psbtBuffer, { inputsToSign }, false)
      
      const signedPsbtBase64 = signedPsbtBuffer.toString('base64')
      
      // Actualizar la instancia con el PSBT firmado
      const signedPsbtInstance = bitcoin.Psbt.fromBuffer(signedPsbtBuffer, { network: bitcoin.networks.bitcoin })
      
      // Verificar que todos los inputs estén firmados
      for (let i = 0; i < signedPsbtInstance.inputCount; i++) {
        const input = signedPsbtInstance.data.inputs[i]
        if (!input.partialSig || input.partialSig.length === 0) {
          throw new Error(`Input #${i} is not signed. Please sign the PSBT first.`)
        }
      }
      
      setPsbt(signedPsbtBase64)
      setPsbtInstance(signedPsbtInstance)
      
      // Finalizar y broadcastear directamente después de firmar
      setBroadcasting(true)
      try {
        // Crear una copia para finalizar
        const finalizedPsbt = bitcoin.Psbt.fromBuffer(signedPsbtInstance.toBuffer(), { network: bitcoin.networks.bitcoin })
        
        try {
          finalizedPsbt.finalizeAllInputs()
        } catch (finalizeError) {
          for (let i = 0; i < finalizedPsbt.inputCount; i++) {
            try {
              finalizedPsbt.finalizeInput(i)
            } catch (inputError) {
              throw new Error(`Cannot finalize input #${i}: ${(inputError as Error).message}. Make sure the PSBT is fully signed.`)
            }
          }
        }

        const tx = finalizedPsbt.extractTransaction()
        const txHex = tx.toHex()

        // Broadcastear usando el contexto
        await UtxoContext.broadcastTransaction(txHex)

        const txid = tx.getId()
        setTxid(txid)
        onResult({ signedPsbtPhantom: signedPsbtBase64, provider: 'phantom', broadcasted: true, txid })
      } catch (broadcastErr) {
        // Si el broadcast falla, aún reportamos que se firmó correctamente
        onResult({ signedPsbtPhantom: signedPsbtBase64, provider: 'phantom' })
        onError(`Phantom broadcast failed: ${(broadcastErr as Error).message || 'Unknown error'}`)
      } finally {
        setBroadcasting(false)
        setLoadingPhantom(false)
      }
    } catch (err) {
      onError(`Phantom: ${(err as Error).message || 'Unknown error'}`)
      setLoadingPhantom(false)
      setBroadcasting(false)
    }
  }

  const totalSelectedValue = Array.from(selectedUtxos).reduce((sum, key) => {
    const utxo = utxos.find((u) => `${u.hash}:${u.index}` === key)
    return sum + (utxo?.value || BigInt(0))
  }, BigInt(0))

  const totalUtxosValue = utxos.reduce((sum, utxo) => sum + utxo.value, BigInt(0))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setMode('generate')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            mode === 'generate'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Generate PSBT
        </button>
        <button
          onClick={() => setMode('sign')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            mode === 'sign'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sign PSBT
        </button>
      </div>

      {mode === 'generate' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              From Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="Bitcoin address"
                className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {connectedAddress && (
                <button
                  onClick={() => setFromAddress(connectedAddress)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Use Connected
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              To Address
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Bitcoin address"
              className="w-full px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount (BTC)
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fee Rate (sats/vbyte)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                  placeholder="Auto"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleFetchFeeRate}
                  disabled={loadingFeeRate}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  title="Fetch recommended fee rate"
                >
                  {loadingFeeRate ? '...' : 'Auto'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              OP_RETURN Data (optional)
            </label>
            <input
              type="text"
              value={opReturnData}
              onChange={(e) => setOpReturnData(e.target.value)}
              placeholder="Data for OP_RETURN output"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">UTXOs</label>
              <button
                onClick={handleFetchUtxos}
                disabled={loadingUtxos || !fromAddress.trim()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loadingUtxos ? 'Loading...' : 'Fetch UTXOs'}
              </button>
            </div>

            {utxos.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded p-2">
                <div className="text-xs text-gray-600 mb-2">
                  Total: {totalUtxosValue.toString()} sats
                  {selectedUtxos.size > 0 && (
                    <span className="ml-2 text-blue-600">
                      Selected: {totalSelectedValue.toString()} sats
                    </span>
                  )}
                </div>
                {utxos.map((utxo) => {
                  const utxoKey = `${utxo.hash}:${utxo.index}`
                  const isSelected = selectedUtxos.has(utxoKey)
                  return (
                    <div
                      key={utxoKey}
                      onClick={() => handleToggleUtxo(utxo)}
                      className={`p-2 text-xs border rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono truncate">{utxo.hash}</div>
                          <div className="text-gray-600">
                            vout: {utxo.index} | {utxo.value.toString()} sats
                          </div>
                        </div>
                        <div className={`ml-2 w-4 h-4 border-2 rounded ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {utxos.length === 0 && !loadingUtxos && fromAddress.trim() && (
              <p className="text-xs text-gray-500 text-center py-4">
                No UTXOs found for this address
              </p>
            )}
            {!fromAddress.trim() && (
              <p className="text-xs text-gray-500 text-center py-4">
                Enter a from address to load UTXOs
              </p>
            )}
          </div>

          <button
            onClick={handleGeneratePsbt}
            disabled={loading || !fromAddress.trim() || !toAddress.trim() || !amount.trim() || utxos.length === 0}
            className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Generate PSBT'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              PSBT (Base64 string)
            </label>
            <textarea
              value={psbt}
              onChange={(e) => {
                setPsbt(e.target.value)
                // Si el usuario pega un PSBT manualmente, limpiar la instancia y los UTXOs
                if (e.target.value.trim() && e.target.value !== psbt) {
                  setPsbtInstance(null)
                  setSelectedUtxosForPsbt([])
                }
              }}
              placeholder="Enter PSBT string or paste generated PSBT"
              className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
              rows={5}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSignPsbt}
              disabled={loading || broadcasting || !psbt.trim()}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading || broadcasting 
                ? (loading ? 'Signing...' : 'Broadcasting...') 
                : 'Sign and Broadcast'}
            </button>
            <button
              onClick={handleSignPsbtWithPhantom}
              disabled={loadingPhantom || broadcasting || !psbt.trim() || !window.phantom?.bitcoin}
              className="px-3 py-2 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title="Sign and Broadcast with Phantom"
            >
              {loadingPhantom || broadcasting 
                ? (loadingPhantom ? 'Signing...' : 'Broadcasting...') 
                : 'Phantom'}
            </button>
          </div>
          
          {txid && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-xs font-medium text-green-800 mb-1">Transaction Broadcasted!</div>
              <div className="text-xs font-mono text-green-700 break-all">
                TXID: {txid}
              </div>
              <a
                href={`https://mempool.space/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
              >
                View on Mempool.space →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
