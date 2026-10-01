import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  FileText,
  MessageCircle,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Clock,
  ArrowUpDown,
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
  fetchReturnReportData,
  getDistinctSpeciesAndBreeds,
  buildWhatsAppLink,
  ReturnReportRow,
  ReturnReportFilters,
} from '@/services/reports'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ITEMS_PER_PAGE = 50

export default function ReturnReportPage() {
  const { clinicName } = useClinicSettings()

  // Opções para dropdowns
  const [speciesList, setSpeciesList] = useState<string[]>([])
  const [breedList, setBreedList] = useState<string[]>([])
  const [breedSearchQuery, setBreedSearchQuery] = useState('')

  // Filtros selecionados (reproduzindo exatamente a tela TechnoVet)
  const [animalName, setAnimalName] = useState('')
  const [species, setSpecies] = useState('all')
  const [breed, setBreed] = useState('all')
  const [gender, setGender] = useState('all')
  const [lastVisitFrom, setLastVisitFrom] = useState('')
  const [lastVisitTo, setLastVisitTo] = useState('')
  const [birthDateFrom, setBirthDateFrom] = useState('')
  const [birthDateTo, setBirthDateTo] = useState('')
  const [birthdayDay, setBirthdayDay] = useState('all')
  const [birthdayMonth, setBirthdayMonth] = useState('all')
  const [returnDateFrom, setReturnDateFrom] = useState('')
  const [returnDateTo, setReturnDateTo] = useState('')

  // Dados carregados e estado de tela
  const [results, setResults] = useState<ReturnReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false)

  // Filtro de raças filtradas pela busca (garantindo ausência de strings vazias)
  const filteredBreeds = useMemo(() => {
    const validBreeds = breedList.filter((b) => typeof b === 'string' && b.trim().length > 0)
    if (!breedSearchQuery.trim()) return validBreeds
    return validBreeds.filter((b) => b.toLowerCase().includes(breedSearchQuery.toLowerCase()))
  }, [breedList, breedSearchQuery])

  // Carrega opções de espécie e raça na montagem (filtrando strings vazias ou nulas)
  useEffect(() => {
    async function loadOptions() {
      const data = await getDistinctSpeciesAndBreeds()
      setSpeciesList(
        (data.species || []).filter((s) => typeof s === 'string' && s.trim().length > 0),
      )
      setBreedList((data.breeds || []).filter((b) => typeof b === 'string' && b.trim().length > 0))
    }
    loadOptions()
  }, [])

  // Executa busca com os filtros atuais
  const handleApplyFilter = async () => {
    setLoading(true)
    setHasAppliedFilter(true)
    setCurrentPage(1)

    const isDayValid = birthdayDay && birthdayDay !== 'all'
    const isMonthValid = birthdayMonth && birthdayMonth !== 'all'

    const birthdayCombined =
      isDayValid && isMonthValid
        ? `${birthdayDay.padStart(2, '0')}/${birthdayMonth.padStart(2, '0')}`
        : undefined

    const filters: ReturnReportFilters = {
      animalName: animalName.trim() || undefined,
      species: species !== 'all' ? species : undefined,
      breed: breed !== 'all' ? breed : undefined,
      gender: gender !== 'all' ? gender : undefined,
      lastVisitFrom: lastVisitFrom || undefined,
      lastVisitTo: lastVisitTo || undefined,
      birthDateFrom: birthDateFrom || undefined,
      birthDateTo: birthDateTo || undefined,
      birthdayDayMonth: birthdayCombined,
      returnDateFrom: returnDateFrom || undefined,
      returnDateTo: returnDateTo || undefined,
    }

    try {
      const data = await fetchReturnReportData(filters)
      setResults(data)
    } catch (err) {
      console.error('Erro ao buscar retornos filtrados:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Inicializa já executando a busca inicial (todos os retornos pendentes)
  useEffect(() => {
    handleApplyFilter()
  }, [])

  // Limpa todos os filtros para o padrão
  const handleResetFilters = () => {
    setAnimalName('')
    setSpecies('all')
    setBreed('all')
    setGender('all')
    setLastVisitFrom('')
    setLastVisitTo('')
    setBirthDateFrom('')
    setBirthDateTo('')
    setBirthdayDay('all')
    setBirthdayMonth('all')
    setReturnDateFrom('')
    setReturnDateTo('')
    setBreedSearchQuery('')
  }

  // Paginação dos resultados
  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE) || 1
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return results.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [results, currentPage])

  // Abertura de impressão do navegador (print stylesheet limpo)
  const handlePrint = () => {
    window.print()
  }

  // Formatador de data auxiliar
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      const d = parseISO(dateStr)
      if (!isValid(d)) return '-'
      return format(d, 'dd/MM/yyyy')
    } catch {
      return dateStr
    }
  }

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
              Retornos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
            Relatório de Retornos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Filtre os retornos previstos e pendentes dos pacientes com link direto para WhatsApp e
            emissão de relatório.
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

      {/* Resumo dos filtros no documento impresso/PDF (visível apenas na primeira página de impressão antes da tabela) */}
      {(returnDateFrom || returnDateTo || species !== 'all' || breed !== 'all' || animalName) && (
        <div className="hidden print:block mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-[9px] text-slate-700 grid grid-cols-4 gap-2">
          {returnDateFrom || returnDateTo ? (
            <div>
              <span className="font-semibold">Período de Retorno:</span>{' '}
              {returnDateFrom ? format(parseISO(returnDateFrom), 'dd/MM/yyyy') : 'Qualquer'} até{' '}
              {returnDateTo ? format(parseISO(returnDateTo), 'dd/MM/yyyy') : 'Qualquer'}
            </div>
          ) : (
            <div>
              <span className="font-semibold">Período de Retorno:</span> Todos os pendentes
            </div>
          )}
          {species !== 'all' && (
            <div>
              <span className="font-semibold">Espécie:</span> {species}
            </div>
          )}
          {breed !== 'all' && (
            <div>
              <span className="font-semibold">Raça:</span> {breed}
            </div>
          )}
          {animalName && (
            <div>
              <span className="font-semibold">Animal:</span> {animalName}
            </div>
          )}
        </div>
      )}

      {/* Layout Principal: Painel de Filtros estilo TechnoVet (Esquerda) + Tabela de Resultados (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* PAINEL DE FILTROS ESTILO TECHNOVET (LG: 4 COLUNAS) */}
        {/* ============================================================== */}
        <Card className="lg:col-span-4 print:hidden border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-100/80 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Painel de Filtros (TechnoVet)
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
              title="Limpar todos os campos"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-3.5 text-xs sm:text-sm">
            {/* 1. Animal (busca por nome) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Animal</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Nome do animal..."
                  value={animalName}
                  onChange={(e) => setAnimalName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {/* 2. Espécie (lista dropdown) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Espécie</Label>
              <Select value={species} onValueChange={setSpecies}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Todas as espécies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Espécies</SelectItem>
                  {speciesList
                    .filter((sp) => typeof sp === 'string' && sp.trim().length > 0)
                    .map((sp) => (
                      <SelectItem key={sp} value={sp}>
                        {sp}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Raça (lista dropdown com busca) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Raça</Label>
              <Select value={breed} onValueChange={setBreed}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Todas as raças" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <div className="p-1 sticky top-0 bg-white z-10 border-b">
                    <Input
                      placeholder="Pesquisar raça..."
                      value={breedSearchQuery}
                      onChange={(e) => setBreedSearchQuery(e.target.value)}
                      className="h-7 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="all">Todas as Raças</SelectItem>
                  {filteredBreeds
                    .filter((br) => typeof br === 'string' && br.trim().length > 0)
                    .map((br) => (
                      <SelectItem key={br} value={br}>
                        {br}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Sexo (dropdown) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Sexo</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sexos</SelectItem>
                  <SelectItem value="Macho">Macho</SelectItem>
                  <SelectItem value="Fêmea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5. Última visita (intervalo de – a) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Última visita (intervalo)
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={lastVisitFrom}
                  onChange={(e) => setLastVisitFrom(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-300"
                />
                <span className="text-xs text-muted-foreground font-medium">a</span>
                <Input
                  type="date"
                  value={lastVisitTo}
                  onChange={(e) => setLastVisitTo(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {/* 6. Nascimento (intervalo de – a) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nascimento (intervalo)</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={birthDateFrom}
                  onChange={(e) => setBirthDateFrom(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-300"
                />
                <span className="text-xs text-muted-foreground font-medium">a</span>
                <Input
                  type="date"
                  value={birthDateTo}
                  onChange={(e) => setBirthDateTo(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {/* 7. Aniversário (seletor dia/mês) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Aniversário (Dia / Mês)
              </Label>
              <div className="flex items-center gap-2">
                <Select value={birthdayDay} onValueChange={setBirthdayDay}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300 flex-1">
                    <SelectValue placeholder="Dia" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="all">Qualquer dia</SelectItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {String(d).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-300 flex-1">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="all">Qualquer mês</SelectItem>
                    <SelectItem value="1">01 - Janeiro</SelectItem>
                    <SelectItem value="2">02 - Fevereiro</SelectItem>
                    <SelectItem value="3">03 - Março</SelectItem>
                    <SelectItem value="4">04 - Abril</SelectItem>
                    <SelectItem value="5">05 - Maio</SelectItem>
                    <SelectItem value="6">06 - Junho</SelectItem>
                    <SelectItem value="7">07 - Julho</SelectItem>
                    <SelectItem value="8">08 - Agosto</SelectItem>
                    <SelectItem value="9">09 - Setembro</SelectItem>
                    <SelectItem value="10">10 - Outubro</SelectItem>
                    <SelectItem value="11">11 - Novembro</SelectItem>
                    <SelectItem value="12">12 - Dezembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 8. Retornos (intervalo de datas de – a) - FILTRO CENTRAL */}
            <div className="space-y-1 p-2.5 rounded-md bg-amber-50/70 border border-amber-200/80">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Retornos (Previsão)
                </Label>
                <span className="text-[10px] text-amber-700 font-medium">Principal</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="date"
                  value={returnDateFrom}
                  onChange={(e) => setReturnDateFrom(e.target.value)}
                  className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                />
                <span className="text-xs text-amber-900 font-bold">a</span>
                <Input
                  type="date"
                  value={returnDateTo}
                  onChange={(e) => setReturnDateTo(e.target.value)}
                  className="h-8 text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                />
              </div>
              <p className="text-[10px] text-amber-800/80 mt-1">
                Considera somente retornos pendentes (não realizados) para contato.
              </p>
            </div>

            {/* Rodapé do Painel com Contador em Destaque estilo TechnoVet ("161 reg.") e Botão Filtrar */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-500 text-white rounded font-mono font-bold text-sm shadow-xs">
                <span>Registros encontrados:</span>
                <span className="text-base tracking-wide bg-emerald-600 px-2 py-0.5 rounded">
                  {loading ? '...' : `${results.length} reg.`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-9"
                >
                  {loading ? 'Filtrando...' : 'Filtrar'}
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

        {/* ============================================================== */}
        {/* TABELA / LISTA DE RESULTADOS (LG: 8 COLUNAS) */}
        {/* ============================================================== */}
        <Card className="lg:col-span-8 border-slate-200 shadow-sm bg-white overflow-hidden print:border-none print:shadow-none">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between print:hidden">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-primary" />
                Relação de Pacientes para Retorno
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Relação: Tutor | Animal | Previsão de Retorno | Contato
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-mono text-xs px-2.5 py-0.5"
              >
                {results.length} registros
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Lista rolável na tela (paginada em tela, oculta na impressão pois a impressão imprime a lista completa em A4) */}
            <div className="overflow-x-auto overflow-y-auto max-h-[640px] print:hidden">
              <Table>
                <TableHeader className="bg-slate-100/90 sticky top-0 z-10 border-b shadow-2xs">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-bold text-slate-800">Tutor</TableHead>
                    <TableHead className="font-bold text-slate-800">Animal</TableHead>
                    <TableHead className="font-bold text-slate-800">Data Retorno</TableHead>
                    <TableHead className="font-bold text-slate-800">Telefone / WhatsApp</TableHead>
                    <TableHead className="w-[60px] text-right font-bold text-slate-800">
                      Ação
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                        Carregando registros de retorno...
                      </TableCell>
                    </TableRow>
                  ) : results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                        Nenhum retorno encontrado com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((row) => {
                      const waLink = buildWhatsAppLink(row.tutorPhone, row.animalName)
                      return (
                        <TableRow
                          key={row.id}
                          className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                        >
                          {/* Tutor */}
                          <TableCell className="font-medium text-slate-900 text-xs sm:text-sm">
                            <span className="uppercase">{row.tutorName}</span>
                          </TableCell>

                          {/* Animal */}
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 uppercase">
                                {row.animalName}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {[row.species, row.breed].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                          </TableCell>

                          {/* Data de Retorno e Motivo */}
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-amber-900">
                                {formatDateStr(row.returnDate)}
                              </span>
                              {row.returnReason && (
                                <span
                                  className="text-[11px] text-muted-foreground truncate max-w-[150px]"
                                  title={row.returnReason}
                                >
                                  {row.returnReason}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Telefone com link direto para WhatsApp */}
                          <TableCell className="text-xs">
                            {row.tutorPhone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-700">{row.tutorPhone}</span>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:text-green-800 transition-colors"
                                    title="Enviar mensagem pelo WhatsApp"
                                  >
                                    <MessageCircle className="w-3 h-3 text-green-600 fill-green-600" />
                                    WhatsApp
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                Não cadastrado
                              </span>
                            )}
                          </TableCell>

                          {/* Ação: Ver Prontuário */}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-primary"
                              asChild
                              title="Abrir prontuário do paciente"
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
            {/* Ocupa 100% da largura A4, repete thead por página e inclui cabeçalho da clínica no thead para paginação perfeita */}
            <div className="hidden print:block w-full">
              <table className="w-full border-collapse text-[10px] text-slate-900 table-fixed">
                <thead className="table-header-group">
                  {/* Cabeçalho da clínica repetido no topo de cada página A4 impressa */}
                  <tr className="border-b-2 border-slate-800">
                    <th colSpan={4} className="p-0 pb-3 text-left font-normal">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-900">
                            {clinicName || 'Clínica Veterinária'}
                          </div>
                          <div className="text-xs font-semibold text-slate-700 mt-0.5">
                            Relatório de Retornos de Pacientes
                          </div>
                        </div>
                        <div className="text-right text-[9px] text-slate-500 font-normal">
                          <div>
                            Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                          <div className="font-semibold text-slate-800 mt-0.5">
                            Total: {results.length} retornos
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                  {/* Cabeçalho das colunas com larguras proporcionais para folha A4 (sem Código) */}
                  <tr className="bg-slate-100 border-b border-slate-400 text-left">
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[32%]">
                      Tutor
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[30%]">
                      Animal
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[18%]">
                      Data Retorno
                    </th>
                    <th className="py-1.5 px-2 font-bold text-slate-900 uppercase text-[9px] w-[20%]">
                      Telefone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 italic">
                        Nenhum retorno encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    results.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="border-b border-slate-200 break-inside-avoid"
                      >
                        <td className="py-1.5 px-2 font-medium uppercase align-top truncate">
                          {row.tutorName}
                        </td>
                        <td className="py-1.5 px-2 align-top">
                          <div className="font-bold uppercase text-slate-900">{row.animalName}</div>
                          <div className="text-[9px] text-slate-500 truncate">
                            {[row.species, row.breed].filter(Boolean).join(' • ')}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 align-top">
                          <div className="font-semibold text-slate-900">
                            {formatDateStr(row.returnDate)}
                          </div>
                          {row.returnReason && (
                            <div className="text-[9px] text-slate-500 truncate max-w-[140px]">
                              {row.returnReason}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2 font-mono align-top text-slate-800">
                          {row.tutorPhone || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra de Paginação (oculta na impressão) */}
            {results.length > ITEMS_PER_PAGE && (
              <div className="py-2.5 px-4 bg-slate-50 border-t flex items-center justify-between text-xs text-muted-foreground print:hidden">
                <div>
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, results.length)} de {results.length}{' '}
                  registros
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
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
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
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
