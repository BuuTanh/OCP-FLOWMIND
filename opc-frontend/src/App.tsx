import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Pipeline } from './pages/Pipeline';
import { Financial } from './pages/Financial';
import { Risks } from './pages/Risks';
import { Settings } from './pages/Settings';
import { Guide } from './pages/Guide';
import { Research } from './pages/Research';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/risks" element={<Risks />} />
            <Route path="/research" element={<Research />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
