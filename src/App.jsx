import MarketGauge        from './pages/MarketGauge';
import MarketGaugeEmbed   from './pages/MarketGaugeEmbed';
import { Routes, Route, useLocation } from 'react-router-dom';
import Nav                     from './components/Nav.jsx';
import Home                    from './pages/Home.jsx';
import Schemes                 from './pages/Schemes.jsx';
import CategoryLeaderboard     from './pages/CategoryLeaderboard.jsx';
import STPActual               from './pages/STPActual.jsx';
import CompareSchemes          from './pages/CompareSchemes.jsx';
import LoanVsSIP               from './pages/LoanVsSIP.jsx';
import SIPCalculator           from './pages/SIPCalculator.jsx';
import WealthCreator           from './pages/WealthCreator.jsx';
import FDCalculator            from './pages/FDCalculator.jsx';
import SWPCalculator           from './pages/SWPCalculator';
import FDvsMF                  from './pages/FDvsMF';
import GoalSIP                 from './pages/GoalSIP';
import GoalCalculator          from './pages/GoalCalculator';
import LoanCalc                from './pages/LoanCalc';
import PrepayVsInvest          from './pages/PrepayVsInvest';
import STPCalculator           from './pages/STPCalculator';
import AdminLayout             from './pages/AdminLayout.jsx';
import PortfolioLensLayout     from './pages/PortfolioLens/PortfolioLensLayout.jsx';
import PortfolioLensIndex      from './pages/PortfolioLens/index.jsx';
import PLPlaceholder           from './pages/PortfolioLens/PLPlaceholder.jsx';
import F1HealthCheck           from './pages/PortfolioLens/F1HealthCheck.jsx';
import F2Alerts               from './pages/PortfolioLens/F2Alerts.jsx'
import F3RebalancePlanner     from './pages/PortfolioLens/F3RebalancePlanner.jsx';
import F4ModelPortfolio       from './pages/PortfolioLens/F4ModelPortfolio.jsx';
import F5SendReport           from './pages/PortfolioLens/F5SendReport.jsx';
import F6DataManager           from './pages/PortfolioLens/F6DataManager.jsx';
import E1Dashboard             from './pages/PortfolioLens/E1Dashboard.jsx';
import E2Overview              from './pages/PortfolioLens/E2Overview.jsx';
import E3Holdings              from './pages/PortfolioLens/E3Holdings.jsx';
import E4Overlap               from './pages/PortfolioLens/E4Overlap.jsx';
import E5Performance           from './pages/PortfolioLens/E5Performance.jsx';
import E6CashflowReturns       from './pages/PortfolioLens/E6CashflowReturns.jsx';
import E7CapitalGains          from './pages/PortfolioLens/E7CapitalGains.jsx';
import E8TransactionReport     from './pages/PortfolioLens/E8TransactionReport.jsx';
import PortfolioUpload         from './pages/PortfolioUpload.jsx';
import CoverageDashboard       from './pages/CoverageDashboard.jsx';
import SchemeBasket            from './pages/SchemeBasket';
import PreRetirementPlanner    from './pages/PreRetirementPlanner';
import RDCalculator            from './pages/RDCalculator';
import CapitalGains            from './pages/CapitalGains';
import PostTaxComparator       from './pages/PostTaxComparator';
import InflationAdjustedReturn from './pages/InflationAdjustedReturn';
import PortfolioXIRR           from './pages/PortfolioXIRR';
import RiskProfiler            from './pages/RiskProfiler';
import SchemeMapping           from './pages/SchemeMapping.jsx';
import AmfiMarketCapUpload     from './pages/admin/AmfiMarketCapUpload.jsx';
import Login                   from './pages/Login';
import Upgrade                 from './pages/Upgrade';
import ProtectedRoute          from './components/ProtectedRoute';
import UserManager             from './pages/admin/UserManager';
import ToolAccessMatrix        from './pages/admin/ToolAccessMatrix';
import { AdvisorModeProvider } from './context/AdvisorModeContext';
import AdvisorDashboard        from './advisor/AdvisorDashboard.jsx';
import AdvisorClientView       from './advisor/AdvisorClientView.jsx';
import AdvisorSettings         from './advisor/AdvisorSettings.jsx';

export default function App() {
  const location = useLocation();
  const isAdmin  = location.pathname.startsWith('/admin');

  return (
    <AdvisorModeProvider>
      <>
        {!isAdmin && <Nav />}
        <Routes>

          {/* ── Public routes (Guest / any visitor) ── */}
          <Route path="/"                       element={<Home />} />
          <Route path="/login"                  element={<Login />} />
          <Route path="/upgrade"                element={<Upgrade />} />
          <Route path="/tools/market-gauge"     element={<MarketGauge />} />
          <Route path="/embed/market-gauge"     element={<MarketGaugeEmbed />} />

          {/* Plan tools — public, no login required */}
          <Route path="/loan-vs-sip"            element={<LoanVsSIP />} />
          <Route path="/sip-performance"        element={<SIPCalculator />} />
          <Route path="/wealth-creator"         element={<WealthCreator />} />
          <Route path="/fd-calculator"          element={<FDCalculator />} />
          <Route path="/swp-performance"        element={<SWPCalculator />} />
          <Route path="/fd-vs-mf"              element={<FDvsMF />} />
          <Route path="/goal-sip"              element={<GoalSIP />} />
          <Route path="/goal-calculator"       element={<GoalCalculator />} />
          <Route path="/loan-calculator"       element={<LoanCalc />} />
          <Route path="/prepay-vs-invest"      element={<PrepayVsInvest />} />
          <Route path="/stp-calculator"        element={<STPCalculator />} />
          <Route path="/stp-actual"            element={<STPActual />} />
          <Route path="/scheme-basket"         element={<SchemeBasket />} />
          <Route path="/pre-retirement-planner" element={<PreRetirementPlanner />} />
          <Route path="/rd-calculator"         element={<RDCalculator />} />
          <Route path="/capital-gains"         element={<CapitalGains />} />
          <Route path="/post-tax"              element={<PostTaxComparator />} />
          <Route path="/real-return"           element={<InflationAdjustedReturn />} />
          <Route path="/xirr-calc"             element={<PortfolioXIRR />} />
          <Route path="/risk-profiler"         element={<RiskProfiler />} />

          {/* ── Research routes — Individual required ── */}
          <Route path="/schemes"
            element={<ProtectedRoute requiredRole="individual"><Schemes /></ProtectedRoute>} />
          <Route path="/category-leaderboard"
            element={<ProtectedRoute requiredRole="individual"><CategoryLeaderboard /></ProtectedRoute>} />
          <Route path="/compare-schemes"
            element={<ProtectedRoute requiredRole="individual"><CompareSchemes /></ProtectedRoute>} />

          {/* ── Track / PortfolioLens — Individual required ── */}
          <Route
            path="/portfolio"
            element={<ProtectedRoute requiredRole="individual"><PortfolioLensLayout /></ProtectedRoute>}
          >
            <Route index        element={<PortfolioLensIndex />} />
            <Route path="e1"    element={<E1Dashboard />} />
            <Route path="e2"    element={<E2Overview />} />
            <Route path="e3"    element={<E3Holdings />} />
            <Route path="e4"    element={<E4Overlap />} />
            <Route path="e5"    element={<E5Performance />} />
            <Route path="e6"    element={<E6CashflowReturns />} />
            <Route path="e7"    element={<E7CapitalGains />} />
            <Route path="e8"    element={<E8TransactionReport />} />
            <Route path="f1"    element={<F1HealthCheck />} />
            <Route path="f2"    element={<F2Alerts />} />
            <Route path="f3"    element={<F3RebalancePlanner />} />
            <Route path="f4"    element={<F4ModelPortfolio />} />
            <Route path="f5"    element={<F5SendReport />} />
            <Route path="f6"    element={<F6DataManager />} />
          </Route>

          {/* ── Advisor routes — Advisor required (admin also passes via role hierarchy) ── */}
          <Route
            path="/advisor"
            element={<ProtectedRoute requiredRole="advisor"><AdvisorDashboard /></ProtectedRoute>}
          />
          <Route
            path="/advisor/settings"
            element={<ProtectedRoute requiredRole="advisor"><AdvisorSettings /></ProtectedRoute>}
          />
          <Route
            path="/advisor/client/:id"
            element={<ProtectedRoute requiredRole="advisor"><AdvisorClientView /></ProtectedRoute>}
          />

          {/* ── Admin routes — Admin required ── */}
          <Route
            path="/admin"
            element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}
          >
            <Route path="portfolio-upload" element={<PortfolioUpload />} />
            <Route path="coverage"         element={<CoverageDashboard />} />
            <Route path="scheme-mapping"   element={<SchemeMapping />} />
            <Route path="amfi-marketcap"   element={<AmfiMarketCapUpload />} />
            <Route path="users"            element={<UserManager />} />
            <Route path="tool-access"      element={<ToolAccessMatrix />} />
          </Route>

        </Routes>
      </>
    </AdvisorModeProvider>
  );
}
