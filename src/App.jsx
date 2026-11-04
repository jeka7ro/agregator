import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import MainLayout from './layouts/MainLayout'
import Monitoring from './pages/Monitoring'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Dispatch from './pages/Dispatch'
import CouriersMap from './pages/CouriersMap'
import Customers from './pages/Customers'
import Reputation from './pages/Reputation'
import UsersManagement from './pages/UsersManagement'
import Login from './pages/Login'
import LogoShowcase from './pages/LogoShowcase'

function RootRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/dashboard', search: location.search }} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/logo-showcase" element={<LogoShowcase />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/couriers-map" element={<CouriersMap />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/reputation" element={<Reputation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
