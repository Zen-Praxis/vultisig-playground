import { useState, useEffect } from 'react'
import { getChainProviders } from '../config/chainProviders'

interface ProviderInfo {
  name: string
  available: boolean
  methods: string[]
}

export function useChainProviders(chainName: string) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])

  useEffect(() => {
    if (!window.vultisig) {
      setProviders([])
      return
    }

    const providerNames = getChainProviders(chainName)
    const providersInfo: ProviderInfo[] = []

    providerNames.forEach((providerName) => {
      const providerInstance = (window.vultisig as Record<string, unknown>)[providerName]
      const available = !!providerInstance

      const methodNames: string[] = []
      
      if (providerInstance) {
        const providerObj = providerInstance as Record<string, unknown>
        
        const ownPropertyNames = Object.getOwnPropertyNames(providerObj)
        
        for (const key of ownPropertyNames) {
          const value = providerObj[key]
          if (typeof value === 'function') {
            methodNames.push(key)
          }
        }

        const prototype = Object.getPrototypeOf(providerObj)
        if (prototype && prototype !== Object.prototype) {
          const prototypePropertyNames = Object.getOwnPropertyNames(prototype)
          
          for (const key of prototypePropertyNames) {
            if (key === 'constructor') continue
            const descriptor = Object.getOwnPropertyDescriptor(prototype, key)
            if (descriptor) {
              if (descriptor.value && typeof descriptor.value === 'function') {
                if (!methodNames.includes(key)) {
                  methodNames.push(key)
                }
              } else if (descriptor.get && typeof descriptor.get === 'function') {
                if (!methodNames.includes(key)) {
                  methodNames.push(key)
                }
              }
            }
          }
        }
      }

      providersInfo.push({
        name: providerName,
        available,
        methods: methodNames.sort(),
      })
    })

    setProviders(providersInfo)
  }, [chainName])

  return providers
}

