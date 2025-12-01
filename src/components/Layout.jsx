import { Outlet } from 'react-router-dom'
import ChainMenu from './ChainMenu'

function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Playground Vultisig</h1>
        </div>
        <nav className="p-4">
          <ChainMenu />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
