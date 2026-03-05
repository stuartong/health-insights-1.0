import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UnifiedDashboard } from './components/unified/UnifiedDashboard';
import { DataImportPage } from './components/data-import/DataImportPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { Layout } from './components/layout/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* New unified dashboard - main view */}
        <Route path="/" element={<UnifiedDashboard />} />

        {/* Pages with sidebar layout */}
        <Route element={<Layout />}>
          <Route path="import" element={<DataImportPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
