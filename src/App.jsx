import { Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import Schemes from './pages/Schemes.jsx'
import CategoryLeaderboard from './pages/CategoryLeaderboard.jsx'
import STPActual from './pages/STPActual.jsx'
import CompareSchemes from './pages/CompareSchemes.jsx'
import LoanVsSIP from './pages/LoanVsSIP.jsx'
import SIPCalculator from './pages/SIPCalculator.jsx'
import WealthCreator from './pages/WealthCreator.jsx'
import FDCalculator from './pages/FDCalculator.jsx'
import SWPCalculator from './pages/SWPCalculator'
import FDvsMF from './pages/FDvsMF'
import GoalSIP from './pages/GoalSIP'
import GoalCalculator from './pages/GoalCalculator'
import LoanCalc from './pages/LoanCalc'
import PrepayVsInvest from './pages/PrepayVsInvest'
import STPCalculator from './pages/STPCalculator'
import AdminLayout from './pages/AdminLayout.jsx'
import PortfolioUpload from './pages/PortfolioUpload.jsx'
import CoverageDashboard from './pages/CoverageDashboard.jsx'
import SchemeBasket from './pages/SchemeBasket'
import PreRetirementPlanner from "./pages/PreRetirementPlanner";
import RDCalculator from "./pages/RDCalculator";
import CapitalGains from "./pages/CapitalGains";
import PostTaxComparator from "./pages/PostTaxComparator";
import InflationAdjustedReturn from "./pages/InflationAdjustedReturn";
import PortfolioXIRR from "./pages/PortfolioXIRR";

export default function App() {
  const location = useLocation()
  const isAdmin  = location.pathname.startsWith('/admin')

  return (
    <>
      {!isAdmin && <Nav />}
      <Routes>
        <Route path="/"                     element={<Home />} />
        <Route path="/schemes"              element={<Schemes />} />
        <Route path="/category-leaderboard" element={<CategoryLeaderboard />} />
        <Route path="/stp-actual"           element={<STPActual />} />
        <Route path="/compare-schemes"      element={<CompareSchemes />} />
        <Route path="/loan-vs-sip"          element={<LoanVsSIP />} />
        <Route path="/sip-performance"      element={<SIPCalculator />} />
        <Route path="/wealth-creator"       element={<WealthCreator />} />
        <Route path="/fd-calculator"        element={<FDCalculator />} />
        <Route path="/swp-performance"      element={<SWPCalculator />} />
        <Route path="/fd-vs-mf"             element={<FDvsMF />} />
        <Route path="/goal-sip"             element={<GoalSIP />} />
        <Route path="/goal-calculator"      element={<GoalCalculator />} />
        <Route path="/loan-calculator"      element={<LoanCalc />} />
        <Route path="/prepay-vs-invest"     element={<PrepayVsInvest />} />
        <Route path="/stp-calculator"       element={<STPCalculator />} />
        <Route path="/scheme-basket" element={<SchemeBasket />} />
        <Route path="/pre-retirement-planner" element={<PreRetirementPlanner />} />
        <Route path="/rd-calculator" element={<RDCalculator />} />
        <Route path="/capital-gains" element={<CapitalGains />} />
        <Route path="/post-tax" element={<PostTaxComparator />} />
        <Route path="/real-return" element={<InflationAdjustedReturn />} />
        <Route path="/xirr-calc" element={<PortfolioXIRR />} />
        
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="portfolio-upload" element={<PortfolioUpload />} />
          <Route path="coverage"         element={<CoverageDashboard />} />
        </Route>
      </Routes>
    </>
  )
}
