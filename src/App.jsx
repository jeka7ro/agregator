import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'

export const preloadDashboard = () => import('./pages/Dashboard')
export const preloadDispatch = () => import('./pages/Dispatch')
export const preloadMonitoring = () => import('./pages/Monitoring')

const Monitoring = lazy(preloadMonitoring)
const Dashboard = lazy(preloadDashboard)
const Alerts = lazy(() => import('./pages/Alerts'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Dispatch = lazy(preloadDispatch)
const CouriersMap = lazy(() => import('./pages/CouriersMap'))
const Customers = lazy(() => import('./pages/Customers'))
const Reputation = lazy(() => import('./pages/Reputation'))
const UsersManagement = lazy(() => import('./pages/UsersManagement'))
const Login = lazy(() => import('./pages/Login'))
const LogoShowcase = lazy(() => import('./pages/LogoShowcase'))

function PageSuspenseFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-[#1C1C1E]/85 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
        <div className="w-4 h-4 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 dark:border-emerald-400/30 dark:border-t-emerald-400 animate-spin" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Se încarcă...</span>
      </div>
    </div>
  )
}

function RootRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/dashboard', search: location.search }} replace />
}

function CouriersAliasRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/couriers-map', search: location.search }} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageSuspenseFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/logo-showcase" element={<LogoShowcase />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/couriers-map" element={<CouriersMap />} />
            <Route path="/couriers" element={<CouriersAliasRedirect />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/reputation" element={<Reputation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<RootRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
