import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import BTCPlayground from './pages/chains/BTCPlayground'
import CosmosPlayground from './pages/chains/CosmosPlayground'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="btc" element={<BTCPlayground />} />
        <Route path="cosmos" element={<CosmosPlayground />} />
      </Route>
    </Routes>
  )
}

export default App
