import { useState, useEffect, useCallback, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Layers,
  Activity,
  ArrowRight,
  Eye,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '@/hooks/use-auth'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import {
  auditService,
  AuditLogRecord,
  ACTION_LABELS,
  MODULE_LABELS,
  AuditAction,
  AuditModule,
} from '@/services/audit'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

export function AuditPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { clinicName, clinicSettings } = useClinicSettings()

  // Seletor de usuários cadastrados para o filtro
  const [userOptions, setUserOptions] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([])

  // Filtros
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Paginação no servidor
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [perPage] = useState<number>(25)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modal de Detalhes / Diff
  const [inspectRecord, setInspectRecord] = useState<AuditLogRecord | null>(null)

  const searchInputId = useId()
  const userInputId = useId()
  const moduleInputId = useId()
  const actionInputId = useId()
  const startInputId = useId()
  const endInputId = useId()

  // Proteção de rota para Admin
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Carregar lista de usuários
  useEffect(() => {
    if (user?.role === 'admin') {
      auditService.getAuditedUsers().then(setUserOptions)
    }
  }, [user])

  // Buscar logs paginados
  const fetchLogs = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    setLoading(true)
    try {
      const res = await auditService.getPaged({
        page: currentPage,
        perPage,
        userId: selectedUserId,
        module: selectedModule,
        action: selectedAction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm,
      })
      setLogs(res.items)
      setTotalItems(res.totalItems)
      setTotalPages(res.totalPages)
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err)
    } finally {
      setLoading(false)
    }
  }, [
    user,
    currentPage,
    perPage,
    selectedUserId,
    selectedModule,
    selectedAction,
    startDate,
    endDate,
    searchTerm,
  ])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleResetFilters = () => {
    setSelectedUserId('all')
    setSelectedModule('all')
    setSelectedAction('all')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatDateDisplay = (isoStr?: string) => {
    if (!isoStr) return '-'
    try {
      const d = parseISO(isoStr)
      return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    } catch {
      return isoStr
    }
  }

  if (authLoading || (user && user.role !== 'admin')) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">Verificando permissões de acesso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estilos específicos para Impressão / PDF A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 10pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, nav, aside, header, footer, button, .pagination-controls {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            font-size: 8.5pt !important;
          }
          .print-table thead {
            display: table-header-group !important;
          }
          .print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* Cabeçalho da Clínica em Impressão */}
      <div className="print-only border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              {clinicName || clinicSettings?.name || 'Clínica Veterinária'}
            </h1>
            <p className="text-xs text-slate-600">
              Relatório de Auditoria e Rastreabilidade de Operações
            </p>
            {clinicSettings?.phone && (
              <p className="text-[11px] text-slate-500">Contato: {clinicSettings.phone}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p>Emitido por: {user?.name || user?.email} (Admin)</p>
            <p>
              Total de Registros nesta página: {logs.length} de {totalItems}
            </p>
          </div>
        </div>
      </div>

      {/* Topo da Tela com Identificação do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Auditoria e Rastreabilidade
              </h1>
              <p className="text-sm text-muted-foreground">
                Histórico gerencial de ações realizadas por cada veterinário e usuário no sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-1.5 h-9"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Gerar PDF A4
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="no-print shadow-xs border-slate-200">
        <CardHeader className="pb-3 pt-4 px-4 bg-slate-50/70 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Filtros de Pesquisa
            </CardTitle>
          </div>
          {(selectedUserId !== 'all' ||
            selectedModule !== 'all' ||
            selectedAction !== 'all' ||
            startDate ||
            endDate ||
            searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-slate-900"
            >
              Limpar Filtros
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Usuário / Veterinário */}
          <div className="space-y-1">
            <Label
              htmlFor={userInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <User className="w-3.5 h-3.5 text-slate-400" /> Usuário
            </Label>
            <Select
              value={selectedUserId}
              onValueChange={(val) => {
                setSelectedUserId(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger id={userInputId} className="h-9 text-xs">
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} (
                    {u.role === 'admin' ? 'Admin' : u.role === 'veterinarian' ? 'Vet' : 'Atendente'}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Módulo */}
          <div className="space-y-1">
            <Label
              htmlFor={moduleInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Módulo
            </Label>
            <Select
              value={selectedModule}
              onValueChange={(val) => {
                setSelectedModule(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger id={moduleInputId} className="h-9 text-xs">
                <SelectValue placeholder="Todos os módulos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                <SelectItem value="clinical_records">
                  Ficha Clínica (Evolução/Prescrição)
                </SelectItem>
                <SelectItem value="returns">Agenda de Retornos</SelectItem>
                <SelectItem value="patients">Pacientes</SelectItem>
                <SelectItem value="tutors">Tutores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ação */}
          <div className="space-y-1">
            <Label
              htmlFor={actionInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5 text-slate-400" /> Ação
            </Label>
            <Select
              value={selectedAction}
              onValueChange={(val) => {
                setSelectedAction(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger id={actionInputId} className="h-9 text-xs">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criou (Inclusão)</SelectItem>
                <SelectItem value="update">Alterou (Edição)</SelectItem>
                <SelectItem value="delete">Excluiu</SelectItem>
                <SelectItem value="mark_completed">Marcou Realizado</SelectItem>
                <SelectItem value="reopen">Reabriu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Inicial */}
          <div className="space-y-1">
            <Label
              htmlFor={startInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> De
            </Label>
            <Input
              id={startInputId}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* Data Final */}
          <div className="space-y-1">
            <Label
              htmlFor={endInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Até
            </Label>
            <Input
              id={endInputId}
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* Busca textual */}
          <div className="space-y-1">
            <Label
              htmlFor={searchInputId}
              className="text-xs font-medium text-slate-700 flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" /> Busca livre
            </Label>
            <div className="relative">
              <Input
                id={searchInputId}
                type="text"
                placeholder="Paciente, tutor, texto..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-9 text-xs pr-8"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card className="shadow-xs border-slate-200 overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50/60 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Registros Encontrados ({totalItems})
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-normal">
              Página {currentPage} de {totalPages || 1}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Mostrando até {perPage} itens por página (paginado no servidor)
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="print-table">
              <TableHeader className="bg-slate-50 text-slate-700">
                <TableRow>
                  <TableHead className="w-[160px]">Data / Hora</TableHead>
                  <TableHead className="w-[180px]">Usuário / Função</TableHead>
                  <TableHead className="w-[140px]">Módulo</TableHead>
                  <TableHead className="w-[120px]">Ação</TableHead>
                  <TableHead>Registro Afetado</TableHead>
                  <TableHead>Resumo / Detalhes</TableHead>
                  <TableHead className="text-right w-[90px] no-print">Detalhes</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <span>Carregando histórico de auditoria...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldAlert className="w-8 h-8 text-slate-300" />
                        <p className="font-medium text-slate-700">
                          Nenhum registro de auditoria encontrado com os filtros atuais.
                        </p>
                        <p className="text-xs text-slate-400">
                          Tente limpar os filtros ou selecionar outro período.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action as AuditAction] || {
                      label: log.action,
                      colorClass: 'bg-slate-100 text-slate-800 border-slate-300',
                    }
                    const moduleInfo = MODULE_LABELS[log.module as AuditModule] || {
                      label: log.module,
                      colorClass: 'text-slate-700 bg-slate-50 border-slate-200',
                    }
                    const hasDiff = log.changes && Object.keys(log.changes).length > 0

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Data / Hora */}
                        <TableCell className="align-top font-mono text-xs text-slate-700">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 hidden print:inline" />
                            {formatDateDisplay(log.created)}
                          </div>
                        </TableCell>

                        {/* Usuário */}
                        <TableCell className="align-top">
                          <div className="font-semibold text-slate-900 text-xs">
                            {log.user_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {log.user_role === 'admin'
                              ? 'Administrador'
                              : log.user_role === 'veterinarian'
                                ? 'Veterinário'
                                : 'Atendente'}
                          </div>
                          {log.user_email && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {log.user_email}
                            </div>
                          )}
                        </TableCell>

                        {/* Módulo */}
                        <TableCell className="align-top">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${moduleInfo.colorClass}`}
                          >
                            {moduleInfo.label}
                          </span>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="align-top">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${actionInfo.colorClass}`}
                          >
                            {actionInfo.label}
                          </span>
                        </TableCell>

                        {/* Registro afetado */}
                        <TableCell className="align-top text-xs">
                          {log.patient_name && (
                            <div className="font-semibold text-slate-900">
                              Paciente: <span className="text-primary">{log.patient_name}</span>
                            </div>
                          )}
                          {log.tutor_name && (
                            <div className="text-[11px] text-slate-600">
                              Tutor: {log.tutor_name}
                            </div>
                          )}
                          {log.record_label && !log.patient_name && (
                            <div className="font-medium text-slate-800">{log.record_label}</div>
                          )}
                        </TableCell>

                        {/* Detalhes / Resumo */}
                        <TableCell className="align-top text-xs text-slate-700">
                          <p className="line-clamp-2">{log.details || 'Sem detalhes adicionais'}</p>
                          {hasDiff && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-700 font-medium">
                              <Sparkles className="w-3 h-3" />
                              {Object.keys(log.changes!).length}{' '}
                              {Object.keys(log.changes!).length === 1
                                ? 'campo alterado'
                                : 'campos alterados'}
                            </div>
                          )}
                        </TableCell>

                        {/* Botão Ver Diff / Inspecionar */}
                        <TableCell className="align-top text-right no-print">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectRecord(log)}
                            className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                            title="Ver histórico detalhado e alterações (Diff)"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Controles de Paginação no Servidor */}
        <div className="p-3 bg-slate-50/70 border-t flex flex-col sm:flex-row items-center justify-between gap-3 pagination-controls no-print">
          <div className="text-xs text-muted-foreground">
            Total de {totalItems} {totalItems === 1 ? 'registro' : 'registros'} de auditoria
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </Button>
            <span className="text-xs font-medium px-2">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 text-xs gap-1"
            >
              Próxima <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Inspeção Detalhada / Diff de Campos */}
      <Dialog open={!!inspectRecord} onOpenChange={(open) => !open && setInspectRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {inspectRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Detalhes da Ação de Auditoria
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Identificador de rastreamento: {inspectRecord.id}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                {/* Metadados Básicos */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-medium block">Data e Hora:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateDisplay(inspectRecord.created)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Usuário Responsável:</span>
                    <span className="font-semibold text-slate-800">
                      {inspectRecord.user_name} ({inspectRecord.user_role || 'veterinarian'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Módulo do Sistema:</span>
                    <span className="font-semibold text-slate-800">
                      {MODULE_LABELS[inspectRecord.module as AuditModule]?.label ||
                        inspectRecord.module}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Tipo de Operação:</span>
                    <span className="font-semibold text-slate-800">
                      {ACTION_LABELS[inspectRecord.action as AuditAction]?.label ||
                        inspectRecord.action}
                    </span>
                  </div>
                  {inspectRecord.patient_name && (
                    <div>
                      <span className="text-slate-500 font-medium block">Paciente:</span>
                      <span className="font-semibold text-primary">
                        {inspectRecord.patient_name}
                      </span>
                    </div>
                  )}
                  {inspectRecord.tutor_name && (
                    <div>
                      <span className="text-slate-500 font-medium block">Tutor:</span>
                      <span className="font-semibold text-slate-800">
                        {inspectRecord.tutor_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Descrição textual */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Descrição Registrada:</h4>
                  <div className="p-3 bg-white rounded border border-slate-200 text-slate-700 whitespace-pre-wrap">
                    {inspectRecord.details || 'Nenhum detalhe textual informado.'}
                  </div>
                </div>

                <Separator />

                {/* Diff de Campos Alterados */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center justify-between">
                    <span>Alterações de Campos (Valores Anteriores vs Novos):</span>
                    {inspectRecord.changes && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {Object.keys(inspectRecord.changes).length} alteração(ões)
                      </span>
                    )}
                  </h4>

                  {!inspectRecord.changes || Object.keys(inspectRecord.changes).length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded text-muted-foreground text-center italic">
                      Nenhum diferencial estruturado registrado para esta ação.
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="w-1/3">Campo</TableHead>
                            <TableHead className="w-1/3">Valor Anterior</TableHead>
                            <TableHead className="w-1/3">Valor Novo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(inspectRecord.changes).map(([fieldKey, diff]) => {
                            const fieldTitle = diff.label || fieldKey
                            const oldDisplay =
                              diff.oldValue === null ||
                              diff.oldValue === undefined ||
                              diff.oldValue === ''
                                ? '<Vazio / Não informado>'
                                : typeof diff.oldValue === 'object'
                                  ? JSON.stringify(diff.oldValue)
                                  : String(diff.oldValue)

                            const newDisplay =
                              diff.newValue === null ||
                              diff.newValue === undefined ||
                              diff.newValue === ''
                                ? '<Removido / Vazio>'
                                : typeof diff.newValue === 'object'
                                  ? JSON.stringify(diff.newValue)
                                  : String(diff.newValue)

                            return (
                              <TableRow key={fieldKey} className="hover:bg-slate-50/60">
                                <TableCell className="font-semibold text-slate-800 align-top">
                                  {fieldTitle}
                                  <span className="block font-mono text-[10px] text-slate-400 font-normal">
                                    {fieldKey}
                                  </span>
                                </TableCell>
                                <TableCell className="align-top text-rose-700 bg-rose-50/30 whitespace-pre-wrap font-mono text-[11px]">
                                  {oldDisplay}
                                </TableCell>
                                <TableCell className="align-top text-emerald-700 bg-emerald-50/30 whitespace-pre-wrap font-mono text-[11px]">
                                  {newDisplay}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AuditPage
