import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import Schemes from './pages/Schemes.jsx'
import LoanVsSIP from './pages/LoanVsSIP.jsx'

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/"               element={<Home />} />
        <Route path="/schemes"        element={<Schemes />} />
        <Route path="/loan-vs-sip"    element={<LoanVsSIP />} />
      </Routes>
    </>
  )
}
