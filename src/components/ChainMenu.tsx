import { NavLink } from 'react-router-dom'
import { getChainProviders } from '../config/chainProviders'
import { getProviderDisplayName } from '../config/providerNames'

interface Chain {
  id: string
  name: string
  icon: string
  path: string
}

const chains: Chain[] = [
  { id: 'BTC', name: 'Bitcoin', icon: '/chains/btc.svg', path: '/btc' },
  { id: 'COSMOS', name: 'Cosmos', icon: '/chains/atom.svg', path: '/cosmos' },
  { id: 'ETH', name: 'Ethereum', icon: '/chains/eth.svg', path: '/eth' },
  { id: 'TRON', name: 'Tron', icon: '/chains/tron.svg', path: '/tron' },
  { id: 'ZEC', name: 'Zcash', icon: '/chains/zec.svg', path: '/zcash' },
  { id: 'DOGE', name: 'Dogecoin', icon: '/chains/doge.svg', path: '/doge' },
  { id: 'BCH', name: 'Bitcoin Cash', icon: '/chains/bch.svg', path: '/bch' },
  { id: 'LTC', name: 'Litecoin', icon: '/chains/ltc.svg', path: '/ltc' },
  { id: 'RUNE', name: 'Thorchain', icon: '/chains/rune.svg', path: '/rune' },
  { id: 'MAYA', name: 'Mayachain', icon: '/chains/maya.svg', path: '/maya' },
  { id: 'XRP', name: 'Ripple', icon: '/chains/xrp.svg', path: '/xrp' },
  { id: 'SOL', name: 'Solana', icon: '/chains/solana.svg', path: '/sol' },
  { id: 'DOT', name: 'Polkadot', icon: '/chains/dot.svg', path: '/dot' },
  { id: 'DASH', name: 'Dash', icon: '/chains/dash.svg', path: '/dash' },
]

function ChainMenu() {
  return (
    <div className="flex flex-col gap-2">
      {chains.map((chain) => {
        const chainKey = chain.path.replace('/', '')
        const providers = getChainProviders(chainKey)

        return (
          <div key={chain.id} className="flex flex-col gap-1">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {chain.name}
            </div>
            {providers.map((provider) => (
              <NavLink
                key={provider}
                to={`${chain.path}/${provider}`}
                className={({ isActive }) =>
                  `px-4 py-2 ml-4 rounded-lg text-sm font-medium transition-all flex items-center ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <img 
                  src={chain.icon} 
                  alt={chain.name}
                  className="w-4 h-4 mr-2"
                />
                {getProviderDisplayName(provider)}
              </NavLink>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default ChainMenu

