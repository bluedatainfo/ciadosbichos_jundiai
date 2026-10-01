import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  FileText,
  MessageCircle,
  RotateCcw,
  Search,
  Filter,
  Syringe,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchPendingVaccinesReport,
  getDistinctSpeciesAndBreeds,
  buildVaccineWhatsAppLink,
  PendingVaccineReportItem,
} from '@/services/reports'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ITEMS_PER_PAGE = 50

const INTERVAL_OPTIONS = [
  { value: '6', label: 'Mais de 6 meses sem vacinar' },
  { value: '12', label: 'Mais de 12 meses (1 ano - Padrão)' },
  { value: '24', label: 'Mais de 24 meses (2 anos)' },
  { value: '36', label: 'Mais de 36 meses (3 anos)' },
]

export default function PendingVaccinesReportPage() {
  const { clinicName } = useClinicSettings()

  // Filtros
  const [intervalMonths, setIntervalMonths] = useState<string>('12')
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'no_record'>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [speciesList, setSpeciesList] = useState<string[]>([])

  // Dados e paginação
  const [results, setResults] = useState<PendingVaccineReportItem[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)

  // Carrega lista de espécies
  useEffect(() => {
    async function loadOptions() {
      const data = await getDistinctSpeciesAndBreeds()
      setSpeciesList(
        (data.species || []).filter((s) => typeof s === 'string' && s.trim().length > 0),
      )
    }
    loadOptions()
  }, [])

  // Carrega dados da API
  const loadData = async (pageToLoad = 1) => {
    setLoading(true)
    try {
      const months = parseInt(intervalMonths, 10) || 12

      const res = await fetchPendingVaccinesReport({
        intervalMonths: months,
        species: selectedSpecies !== 'all' ? selectedSpecies : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
        page: pageToLoad,
        limit: ITEMS_PER_PAGE,
      })

      setResults(res.items || [])
      setTotalCount(res.total || 0)
      setTotalPages(res.totalPages || 1)
      setCurrentPage(res.page || 1)
    } catch (err) {
      console.error('Erro ao carregar vacinas pendentes:', err)
      setResults([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Busca inicial (padrão de 12 meses)
  useEffect(() => {
    loadData(1)
  }, [])

  const handleApplyFilter = () => {
    loadData(1)
  }

  const handleResetFilters = () => {
    setIntervalMonths('12')
    setStatusFilter('all')
    setSelectedSpecies('all')
    setSearchQuery('')
    setTimeout(() => {
      loadData(1)
    }, 10)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatDateStr = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const d = parseISO(dateStr)
      if (!isValid(d)) return '-'
      return format(d, 'dd/MM/yyyy')
    } catch {
      return dateStr
    }
  }

  const intervalLabel =
    INTERVAL_OPTIONS.find((i) => i.value === intervalMonths)?.label || `${intervalMonths} meses`

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho da Página - Oculto na impressão */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-primary">
              Relatórios
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs uppercase tracking-wider font-medium text-slate-600">
              Vacinas Pendentes
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
            <Syringe className="w-7 h-7 text-amber-600" />
            Relatório de Vacinas Pendentes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identifique pacientes com vacinação atrasada ou sem registro de vacinas para campanhas
            de reforço imunológico e acionamento dos tutores.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="gap-2 border-slate-300 hover:bg-slate-100"
          >
            <Printer className="w-4 h-4 text-slate-700" /> Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="gap-2 border-slate-300 hover:bg-slate-100"
          >
            <FileText className="w-4 h-4 text-slate-700" /> Gerar PDF
          </Button>
        </div>
      </div>

      {/* Resumo do filtro na impressão */}
      <div className="hidden print:block mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-[9px] text-slate-700 grid grid-cols-4 gap-2">
        <div>
          <span className="font-semibold">Critério de Atraso:</span> {intervalLabel}
        </div>
        <div>
          <span className="font-semibold">Situação:</span>{' '}
          {statusFilter === 'overdue'
            ? 'Apenas Atrasadas'
            : statusFilter === 'no_record'
              ? 'Apenas Sem Registro'
              : 'Todas as Pendentes'}
        </div>
        {selectedSpecies !== 'all' && (
          <div>
            <span className="font-semibold">Espécie:</span> {selectedSpecies}
          </div>
        )}
        {searchQuery && (
          <div>
            <span className="font-semibold">Busca:</span> {searchQuery}
          </div>
        )}
      </div>

      {/* Grid: Painel de Filtros à esquerda (4 colunas) + Tabela de Resultados à direita (8 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel de Filtros */}
        <Card className="lg:col-span-4 print:hidden border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-100/80 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Filtros do Relatório
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
              title="Restaurar padrão"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-3.5 text-xs sm:text-sm">
            {/* Intervalo / Critério de Atraso (Destaque Principal) */}
            <div className="space-y-1 p-2.5 rounded-md bg-amber-50/70 border border-amber-200/80">
              <Label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Intervalo desde a Última Vacina
              </Label>
              <Select value={intervalMonths} onValueChange={setIntervalMonths}>
                <SelectTrigger className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500">
                  <SelectValue placeholder="Selecione o intervalo" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-amber-800/80 mt-1">
                Considera atrasados os animais cuja última vacina ocorreu há mais tempo que o
                intervalo.
              </p>
            </div>

            {/* Situação da Vacinação */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Situação</Label>
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Todas as pendentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Pendentes (Atrasadas + Sem Registro)</SelectItem>
                  <SelectItem value="overdue">
                    Apenas Atrasadas (já vacinados no passado)
                  </SelectItem>
                  <SelectItem value="no_record">Apenas Sem Nenhum Registro de Vacina</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Espécie */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Espécie</Label>
              <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Todas as espécies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Espécies</SelectItem>
                  {speciesList.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual por animal ou tutor */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Animal ou Tutor</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Nome do animal, tutor, código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {/* Contador em destaque estilo visor clássico */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-600 text-white rounded font-mono font-bold text-sm shadow-xs">
                <span>Vacinas pendentes:</span>
                <span className="text-base tracking-wide bg-amber-700 px-2 py-0.5 rounded">
                  {loading ? '...' : `${totalCount} reg.`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9"
                >
                  {loading ? 'Buscando...' : 'Filtrar Vacinas'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetFilters}
                  disabled={loading}
                  className="text-xs h-9"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Resultados */}
        <Card className="lg:col-span-8 border-slate-200 shadow-sm bg-white overflow-hidden print:border-none print:shadow-none">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between print:hidden">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Syringe className="w-4 h-4 text-amber-600" />
                Pacientes com Vacinação Pendente ({intervalLabel})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exclui automaticamente animais em óbito. Contato via WhatsApp com mensagem
                formatada.
              </p>
            </div>

            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-xs px-2.5 py-0.5"
            >
              {totalCount} registros
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {/* Visualização de Tela */}
            <div className="overflow-x-auto overflow-y-auto max-h-[640px] print:hidden">
              <Table>
                <TableHeader className="bg-slate-100/90 sticky top-0 z-10 border-b shadow-2xs">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-bold text-slate-800">Animal</TableHead>
                    <TableHead className="font-bold text-slate-800">Espécie / Raça</TableHead>
                    <TableHead className="font-bold text-slate-800">Última Vacina</TableHead>
                    <TableHead className="font-bold text-slate-800">Situação</TableHead>
                    <TableHead className="font-bold text-slate-800">Tutor / WhatsApp</TableHead>
                    <TableHead className="w-[50px] text-right font-bold text-slate-800">
                      Ação
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                        Carregando registros de vacinas pendentes...
                      </TableCell>
                    </TableRow>
                  ) : results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                        Nenhum animal com vacinação pendente para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    results.map((row) => {
                      const waLink = buildVaccineWhatsAppLink(row.tutorPhone, row.animalName)

                      return (
                        <TableRow
                          key={row.id}
                          className="hover:bg-amber-50/30 transition-colors border-b border-slate-100"
                        >
                          {/* Animal */}
                          <TableCell className="text-xs sm:text-sm font-semibold text-slate-900 uppercase">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 uppercase">
                                {row.animalName}
                              </span>
                              {row.ctrl && row.ctrl !== '0' && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  Cód: {row.ctrl}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Espécie / Raça */}
                          <TableCell className="text-xs text-slate-700">
                            {[row.species, row.breed].filter(Boolean).join(' • ') || '-'}
                          </TableCell>

                          {/* Última Vacinação */}
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span
                                className={`font-semibold ${
                                  row.lastVaccineDate ? 'text-slate-800' : 'text-slate-400 italic'
                                }`}
                              >
                                {formatDateStr(row.lastVaccineDate)}
                              </span>
                              {row.vaccineCount > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {row.vaccineCount}{' '}
                                  {row.vaccineCount === 1 ? 'dose gravada' : 'doses gravadas'}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Situação */}
                          <TableCell className="text-xs">
                            {row.status === 'overdue' ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-semibold gap-1 inline-flex items-center"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                Atrasada
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 text-slate-700 border-slate-300 text-[11px] font-normal"
                              >
                                Sem registro
                              </Badge>
                            )}
                          </TableCell>

                          {/* Tutor com WhatsApp */}
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 uppercase">
                                {row.tutorName}
                              </span>
                              {row.tutorPhone ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-slate-600 text-[11px]">
                                    {row.tutorPhone}
                                  </span>
                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                                      title="Avisar tutor pelo WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3 text-green-600 fill-green-600" />
                                      Lembrar Vacina
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px]">
                                  Sem telefone
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Prontuário */}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-primary"
                              asChild
                              title="Abrir prontuário"
                            >
                              <Link to={`/pacientes/${row.patientId}`}>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* TABELA DE IMPRESSÃO / PDF (EXCLUSIVA PARA FOLHA A4) */}
            <div className="hidden print:block w-full">
              <table className="w-full border-collapse text-[10px] text-slate-900 table-fixed">
                <thead className="table-header-group">
                  <tr className="border-b-2 border-slate-800">
                    <th colSpan={5} className="p-0 pb-3 text-left font-normal">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-900">
                            {clinicName || 'Clínica Veterinária'}
                          </div>
                          <div className="text-xs font-semibold text-slate-700 mt-0.5">
                            Relatório de Vacinas Pendentes ({intervalLabel})
                          </div>
                        </div>
                        <div className="text-right text-[9px] text-slate-500 font-normal">
                          <div>
                            Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                          <div className="font-semibold text-slate-800 mt-0.5">
                            Total: {totalCount} pacientes
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr className="bg-slate-100 border-b border-slate-400 text-left">
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[26%]">
                      Animal
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[22%]">
                      Espécie / Raça
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[16%]">
                      Última Vacina
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[14%]">
                      Situação
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[22%]">
                      Tutor / Telefone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                        Nenhum registro de vacina pendente encontrado.
                      </td>
                    </tr>
                  ) : (
                    results.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="border-b border-slate-200 break-inside-avoid"
                      >
                        <td className="py-1.5 px-2 font-bold uppercase align-top">
                          {row.animalName}
                        </td>
                        <td className="py-1.5 px-2 align-top text-slate-700">
                          {[row.species, row.breed].filter(Boolean).join(' • ') || '-'}
                        </td>
                        <td className="py-1.5 px-2 align-top">
                          {formatDateStr(row.lastVaccineDate)}
                        </td>
                        <td className="py-1.5 px-2 align-top font-semibold">{row.situation}</td>
                        <td className="py-1.5 px-2 align-top">
                          <div className="uppercase font-medium">{row.tutorName}</div>
                          <div className="font-mono text-[9px] text-slate-600">
                            {row.tutorPhone || '-'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="py-2.5 px-4 bg-slate-50 border-t flex items-center justify-between text-xs text-muted-foreground print:hidden">
                <div>
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} registros
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => loadData(currentPage - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-slate-700">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => loadData(currentPage + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
