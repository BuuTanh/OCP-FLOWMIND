import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contracts } from './pages/Contracts';
import { Pipeline } from './pages/Pipeline';
import { Financial } from './pages/Financial';
import { Risks } from './pages/Risks';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/risks" element={<Risks />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
