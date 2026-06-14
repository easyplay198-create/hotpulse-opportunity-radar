import { HomePage } from './pages/HomePage';
import { AnalyzePage } from './pages/AnalyzePage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { CasesPage } from './pages/CasesPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ReportPage } from './pages/ReportPage';

function App() {
  const pathname = window.location.pathname;

  if (pathname === '/opportunities' || pathname === '/signals') return <OpportunitiesPage />;
  if (pathname === '/analyze' || pathname === '/advisor-result') return <AnalyzePage />;
  if (pathname === '/cases') return <CasesPage />;
  if (pathname === '/resources') return <ResourcesPage />;
  if (pathname === '/report') return <ReportPage />;

  return <HomePage />;
}

export default App;
