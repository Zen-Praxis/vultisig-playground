import { useState, useEffect, useCallback } from 'react'

interface ProviderStatus {
  name: string
  detected: boolean
}

export function useProviderStatus() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])

  const refreshStatus = useCallback((): void => {
    if (!window.vultisig) {
      setProviders([])
      return
    }

    const providerNames = ['bitcoin', 'cosmos']
    const statuses = providerNames.map((name) => {
      const provider = (window.vultisig as Record<string, unknown>)[name]
      
      return {
        name,
        detected: !!provider,
      }
    })

    setProviders(statuses)
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  return {
    providers,
    refreshStatus,
  }
}

