import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from '@/components/Layout'
import { ManualProvider } from '@/hooks/use-manual'
import { ManualSheet } from '@/components/ManualSheet'
import { ClinicSettingsProvider } from '@/hooks/use-clinic-settings'
import Index from '@/pages/Index'
import Patients from '@/pages/Patients'
import PatientProfile from '@/pages/PatientProfile'
import Agenda from '@/pages/Agenda'
import Settings from '@/pages/Settings'
import Inventory from '@/pages/Inventory'
import UsersPage from '@/pages/Users'
import Import from '@/pages/Import'
import Login from '@/pages/Login'
import PublicBooking from '@/pages/PublicBooking'
import ReturnReportPage from '@/pages/ReturnReportPage'
import NotFound from '@/pages/NotFound'
import { AuthProvider, useAuth } from '@/hooks/use-auth'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/agendamento" element={<PublicBooking />} />
      <Route path="/agendamento-online" element={<PublicBooking />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Index />} />
        <Route path="/pacientes" element={<Patients />} />
        <Route path="/pacientes/:id" element={<PatientProfile />} />
        <Route path="/relatorios/retornos" element={<ReturnReportPage />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/estoque" element={<Inventory />} />
        <Route path="/importacao" element={<Import />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

const App = () => (
  <AuthProvider>
    <ClinicSettingsProvider>
      <BrowserRouter>
        <ManualProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
            <ManualSheet />
          </TooltipProvider>
        </ManualProvider>
      </BrowserRouter>
    </ClinicSettingsProvider>
  </AuthProvider>
)

export default App
