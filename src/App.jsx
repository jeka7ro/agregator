import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Monitoring from './pages/Monitoring'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Dispatch from './pages/Dispatch'
import LogoShowcase from './pages/LogoShowcase'

function RootRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/dashboard', search: location.search }} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/logo-showcase" element={<LogoShowcase />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
