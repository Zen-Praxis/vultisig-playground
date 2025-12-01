import { NavLink } from 'react-router-dom'

interface Chain {
  id: string
  name: string
  icon: string
  path: string
}

const chains: Chain[] = [
  { id: 'BTC', name: 'Bitcoin', icon: '/chains/btc.svg', path: '/btc' },
  { id: 'COSMOS', name: 'Cosmos', icon: '/chains/atom.svg', path: '/cosmos' },
]

function ChainMenu() {
  return (
    <div className="flex flex-col gap-2">
      {chains.map((chain) => (
        <NavLink
          key={chain.id}
          to={chain.path}
          className={({ isActive }) =>
            `px-4 py-3 rounded-lg font-medium transition-all flex items-center ${
              isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <img 
            src={chain.icon} 
            alt={chain.name}
            className="w-5 h-5 mr-3"
          />
          {chain.name}
        </NavLink>
      ))}
    </div>
  )
}

export default ChainMenu

