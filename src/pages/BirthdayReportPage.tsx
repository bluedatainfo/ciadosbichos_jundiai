import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  FileText,
  MessageCircle,
  RotateCcw,
  Search,
  Filter,
  Cake,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
  fetchBirthdaysReport,
  getDistinctSpeciesAndBreeds,
  buildBirthdayWhatsAppLink,
  BirthdayReportItem,
} from '@/services/reports'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ITEMS_PER_PAGE = 50

const MONTHS = [
  { value: '1', label: '01 - Janeiro' },
  { value: '2', label: '02 - Fevereiro' },
  { value: '3', label: '03 - Março' },
  { value: '4', label: '04 - Abril' },
  { value: '5', label: '05 - Maio' },
  { value: '6', label: '06 - Junho' },
  { value: '7', label: '07 - Julho' },
  { value: '8', label: '08 - Agosto' },
  { value: '9', label: '09 - Setembro' },
  { value: '10', label: '10 - Outubro' },
  { value: '11', label: '11 - Novembro' },
  { value: '12', label: '12 - Dezembro' },
]

export default function BirthdayReportPage() {
  const { clinicName } = useClinicSettings()

  const currentMonthNum = new Date().getMonth() + 1

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonthNum))
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [speciesList, setSpeciesList] = useState<string[]>([])

  // Dados e paginação
  const [results, setResults] = useState<BirthdayReportItem[]>([])
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
      const monthNum = parseInt(selectedMonth, 10) || currentMonthNum
      const dayNum = selectedDay !== 'all' ? parseInt(selectedDay, 10) : undefined

      const res = await fetchBirthdaysReport({
        month: monthNum,
        day: dayNum,
        species: selectedSpecies !== 'all' ? selectedSpecies : undefined,
        search: searchQuery.trim() || undefined,
        page: pageToLoad,
        limit: ITEMS_PER_PAGE,
      })

      setResults(res.items || [])
      setTotalCount(res.total || 0)
      setTotalPages(res.totalPages || 1)
      setCurrentPage(res.page || 1)
    } catch (err) {
      console.error('Erro ao carregar aniversariantes:', err)
      setResults([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Busca inicial (mês atual)
  useEffect(() => {
    loadData(1)
  }, [])

  const handleApplyFilter = () => {
    loadData(1)
  }

  const handleResetFilters = () => {
    setSelectedMonth(String(currentMonthNum))
    setSelectedDay('all')
    setSelectedSpecies('all')
    setSearchQuery('')
    // Carrega com os padrões
    setTimeout(() => {
      loadData(1)
    }, 10)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatBirthDayMonth = (dateStr: string, bDay: number | null) => {
    if (bDay) {
      const d = String(bDay).padStart(2, '0')
      const m = String(selectedMonth).padStart(2, '0')
      return `${d}/${m}`
    }
    if (!dateStr) return '-'
    try {
      const d = parseISO(dateStr)
      if (!isValid(d)) return '-'
      return format(d, 'dd/MM')
    } catch {
      return dateStr
    }
  }

  const selectedMonthLabel =
    MONTHS.find((m) => m.value === selectedMonth)?.label || `Mês ${selectedMonth}`

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
              Aniversariantes
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
            <Cake className="w-7 h-7 text-pink-600" />
            Aniversariantes do Mês
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Localize os pacientes que fazem aniversário no mês para envio de felicitações, campanhas
            e contato via WhatsApp.
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
      <div className="hidden print:block mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-[9px] text-slate-700 grid grid-cols-3 gap-2">
        <div>
          <span className="font-semibold">Mês de Referência:</span> {selectedMonthLabel}
          {selectedDay !== 'all' ? ` (Dia ${selectedDay})` : ' (Todos os dias)'}
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
            {/* Seletor de Mês (Destaque principal) */}
            <div className="space-y-1 p-2.5 rounded-md bg-pink-50/70 border border-pink-200/80">
              <Label className="text-xs font-bold text-pink-950 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-pink-700" />
                Mês do Aniversário
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs bg-white border-pink-300 focus-visible:ring-pink-500">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dia do Mês opcional */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Dia do Mês (Opcional)</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Qualquer dia" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="all">Qualquer dia do mês</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {String(d).padStart(2, '0')}
                    </SelectItem>
                  ))}
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
                  placeholder="Nome do animal, tutor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {/* Contador de registros em destaque estilo visor digital clássico */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between px-3 py-2 bg-pink-600 text-white rounded font-mono font-bold text-sm shadow-xs">
                <span>Aniversariantes:</span>
                <span className="text-base tracking-wide bg-pink-700 px-2 py-0.5 rounded">
                  {loading ? '...' : `${totalCount} reg.`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs h-9"
                >
                  {loading ? 'Buscando...' : 'Filtrar Aniversariantes'}
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
                <Cake className="w-4 h-4 text-pink-600" />
                Pacientes que fazem aniversário em {selectedMonthLabel}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Relação ordenada pelo dia do mês com idade que completará e link direto de WhatsApp.
              </p>
            </div>

            <Badge
              variant="outline"
              className="bg-pink-50 text-pink-700 border-pink-300 font-mono text-xs px-2.5 py-0.5"
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
                    <TableHead className="font-bold text-slate-800 w-[70px]">Dia</TableHead>
                    <TableHead className="font-bold text-slate-800">Animal</TableHead>
                    <TableHead className="font-bold text-slate-800">Espécie / Raça</TableHead>
                    <TableHead className="font-bold text-slate-800">Idade</TableHead>
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
                        Carregando aniversariantes...
                      </TableCell>
                    </TableRow>
                  ) : results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                        Nenhum animal aniversariante encontrado para os critérios selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    results.map((row) => {
                      const waLink = buildBirthdayWhatsAppLink(
                        row.tutorPhone,
                        row.animalName,
                        row.turningAge,
                      )

                      return (
                        <TableRow
                          key={row.id}
                          className="hover:bg-pink-50/30 transition-colors border-b border-slate-100"
                        >
                          {/* Dia */}
                          <TableCell className="font-mono font-bold text-pink-700 text-xs">
                            {formatBirthDayMonth(row.birthDate, row.birthdayDay)}
                          </TableCell>

                          {/* Animal */}
                          <TableCell className="text-xs sm:text-sm font-semibold text-slate-900 uppercase">
                            <div className="flex items-center gap-1.5">
                              <span>{row.animalName}</span>
                              {row.gender && (
                                <span className="text-[10px] text-muted-foreground font-normal lowercase">
                                  ({row.gender.charAt(0)})
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Espécie / Raça */}
                          <TableCell className="text-xs text-slate-700">
                            {[row.species, row.breed].filter(Boolean).join(' • ') || '-'}
                          </TableCell>

                          {/* Idade */}
                          <TableCell className="text-xs">
                            {row.turningAge !== null ? (
                              <Badge
                                variant="secondary"
                                className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-medium"
                              >
                                Completa {row.turningAge} {row.turningAge === 1 ? 'ano' : 'anos'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">-</span>
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
                                      title="Enviar felicitação no WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3 text-green-600 fill-green-600" />
                                      Parabenizar
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
                            Relatório de Aniversariantes do Mês — {selectedMonthLabel}
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
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[12%]">
                      Dia/Mês
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[26%]">
                      Animal
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[24%]">
                      Espécie / Raça
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[14%]">
                      Idade
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[24%]">
                      Tutor / Telefone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                        Nenhum aniversariante encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    results.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="border-b border-slate-200 break-inside-avoid"
                      >
                        <td className="py-1.5 px-2 font-mono font-bold align-top">
                          {formatBirthDayMonth(row.birthDate, row.birthdayDay)}
                        </td>
                        <td className="py-1.5 px-2 font-bold uppercase align-top">
                          {row.animalName}
                        </td>
                        <td className="py-1.5 px-2 align-top text-slate-700">
                          {[row.species, row.breed].filter(Boolean).join(' • ') || '-'}
                        </td>
                        <td className="py-1.5 px-2 align-top">
                          {row.turningAge !== null ? `${row.turningAge} anos` : '-'}
                        </td>
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
