import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import BirthdayReportPage from '@/pages/BirthdayReportPage'
import PendingVaccinesReportPage from '@/pages/PendingVaccinesReportPage'
import SpeciesStatsReportPage from '@/pages/SpeciesStatsReportPage'
import { AuditPage } from '@/pages/AuditPage'
import PrescriptionPage from '@/pages/PrescriptionPage'
import NotFound from '@/pages/NotFound'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { canUserAccessPath, getDefaultPathForUser } from '@/config/modules'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

/**
 * Guarda de módulo para rotas individuais:
 * Se o usuário não tiver permissão para acessar o módulo da rota solicitada,
 * redireciona para a tela inicial do usuário com a mensagem "Você não tem acesso a este módulo".
 */
const ModuleGuard = ({ children, path }: { children: React.ReactNode; path: string }) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const hasAccess = canUserAccessPath(path, user)
  const warnedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hasAccess && warnedPathRef.current !== location.pathname) {
      warnedPathRef.current = location.pathname
      toast({
        title: 'Acesso negado',
        description: 'Você não tem acesso a este módulo',
        variant: 'destructive',
      })
    }
  }, [hasAccess, location.pathname, toast])

  if (!hasAccess) {
    const fallbackPath = getDefaultPathForUser(user)
    // Se o fallback for a própria rota que tentou (para evitar loop), manda para /login se deslogado
    const target = fallbackPath === path ? '/login' : fallbackPath
    return <Navigate to={target} replace />
  }

  return <>{children}</>
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
        <Route
          path="/"
          element={
            <ModuleGuard path="/">
              <Index />
            </ModuleGuard>
          }
        />
        <Route
          path="/pacientes"
          element={
            <ModuleGuard path="/pacientes">
              <Patients />
            </ModuleGuard>
          }
        />
        <Route
          path="/pacientes/:id"
          element={
            <ModuleGuard path="/pacientes">
              <PatientProfile />
            </ModuleGuard>
          }
        />
        <Route
          path="/receituario"
          element={
            <ModuleGuard path="/receituario">
              <PrescriptionPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/relatorios/retornos"
          element={
            <ModuleGuard path="/relatorios/retornos">
              <ReturnReportPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/relatorios/aniversariantes"
          element={
            <ModuleGuard path="/relatorios/aniversariantes">
              <BirthdayReportPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/relatorios/vacinas"
          element={
            <ModuleGuard path="/relatorios/vacinas">
              <PendingVaccinesReportPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/relatorios/estatisticas"
          element={
            <ModuleGuard path="/relatorios/estatisticas">
              <SpeciesStatsReportPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/agenda"
          element={
            <ModuleGuard path="/agenda">
              <Agenda />
            </ModuleGuard>
          }
        />
        <Route
          path="/estoque"
          element={
            <ModuleGuard path="/estoque">
              <Inventory />
            </ModuleGuard>
          }
        />
        <Route
          path="/importacao"
          element={
            <ModuleGuard path="/importacao">
              <Import />
            </ModuleGuard>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ModuleGuard path="/usuarios">
              <UsersPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ModuleGuard path="/configuracoes">
              <Settings />
            </ModuleGuard>
          }
        />
        <Route
          path="/auditoria"
          element={
            <ModuleGuard path="/auditoria">
              <AuditPage />
            </ModuleGuard>
          }
        />
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
