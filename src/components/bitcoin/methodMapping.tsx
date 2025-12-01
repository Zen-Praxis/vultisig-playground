import { RequestMethod } from './RequestMethod'
import { RequestAccountsMethod } from './RequestAccountsMethod'
import type { ReactElement } from 'react'

interface MethodComponentProps {
  provider: unknown
  onResult: (result: unknown) => void
  onError: (error: string) => void
  onAccountUpdate?: (accounts: string[]) => void
}

type MethodComponent = (props: MethodComponentProps) => ReactElement

export const bitcoinMethodMapping: Record<string, MethodComponent> = {
  request: RequestMethod,
  requestAccounts: RequestAccountsMethod,
}

export function getMethodComponent(methodName: string): MethodComponent | null {
  return bitcoinMethodMapping[methodName] || null
}

