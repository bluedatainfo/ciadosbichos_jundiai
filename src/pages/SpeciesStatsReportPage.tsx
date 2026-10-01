import React, { useState, useEffect } from 'react'
import {
  Printer,
  FileText,
  RotateCcw,
  BarChart3,
  Users,
  PawPrint,
  Syringe,
  HeartCrack,
  Activity,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchSpeciesStatsReport, SpeciesStatsReportResponse } from '@/services/reports'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function SpeciesStatsReportPage() {
  const { clinicName } = useClinicSettings()

  const [stats, setStats] = useState<SpeciesStatsReportResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSpeciesStatsReport()
      setStats(data)
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err)
      setError(err?.message || 'Falha ao processar estatísticas agregadas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handlePrint = () => {
    window.print()
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
              Estatísticas de Espécies
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Estatísticas da Base e Espécies
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão consolidada da base clínica: total de tutores, pacientes ativos, distribuição por
            espécie e raças mais atendidas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 border-slate-300 hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Atualizar
          </Button>
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

      {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO / PDF A4 */}
      <div className="hidden print:block w-full border-b-2 border-slate-800 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-base font-bold uppercase tracking-wide text-slate-900">
              {clinicName || 'Clínica Veterinária'}
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Relatório Consolidado de Estatísticas de Espécies e Pacientes
            </div>
          </div>
          <div className="text-right text-[9px] text-slate-500 font-normal">
            <div>Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
            <div className="font-semibold text-slate-800 mt-0.5">Visão Gerencial Completa</div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="py-20 text-center text-muted-foreground text-sm">
            Processando e calculando totais da base de dados...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-10 text-center text-red-700 text-sm">
            Ocorreu um erro ao carregar as estatísticas: {error}
          </CardContent>
        </Card>
      ) : !stats ? null : (
        <div className="space-y-6">
          {/* CARDS DE INDICADORES GERAIS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Tutores */}
            <Card className="border-slate-200 shadow-xs print:border-slate-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total de Tutores
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {stats.totalTutors.toLocaleString('pt-BR')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Clientes cadastrados</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            {/* Pacientes Vivos */}
            <Card className="border-slate-200 shadow-xs print:border-slate-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pacientes Ativos
                  </p>
                  <h3 className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                    {stats.totalAlivePatients.toLocaleString('pt-BR')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Animais vivos</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <PawPrint className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            {/* Vacinações Totais */}
            <Card className="border-slate-200 shadow-xs print:border-slate-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Vacinações
                  </p>
                  <h3 className="text-2xl font-bold text-amber-600 mt-1 font-mono">
                    {stats.totalVaccines.toLocaleString('pt-BR')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Doses registradas</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Syringe className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            {/* Total Geral / Óbitos */}
            <Card className="border-slate-200 shadow-xs print:border-slate-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Acumulado
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">
                    {stats.totalPatients.toLocaleString('pt-BR')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {stats.totalDeceasedPatients} óbitos registrados
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <HeartCrack className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DISTRIBUIÇÃO POR ESPÉCIE E SEXO */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Espécies (8 cols) */}
            <Card className="md:col-span-7 border-slate-200 shadow-sm overflow-hidden print:border-slate-300 break-inside-avoid">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PawPrint className="w-4 h-4 text-primary" />
                    Distribuição de Pacientes por Espécie
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {stats.speciesDistribution.length} espécies
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="font-bold text-slate-800">Espécie</TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">
                        Quantidade
                      </TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">
                        % do Total
                      </TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-800 text-right print:hidden">
                        Proporção
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.speciesDistribution.map((item, idx) => (
                      <TableRow key={item.species || idx} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {item.species}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs sm:text-sm">
                          {item.count.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs sm:text-sm text-primary">
                          {item.percentage}%
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sexo (5 cols) */}
            <Card className="md:col-span-5 border-slate-200 shadow-sm overflow-hidden print:border-slate-300 break-inside-avoid">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Distribuição por Sexo
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="font-bold text-slate-800">Sexo</TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">Qtd</TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.genderDistribution.map((item, idx) => (
                      <TableRow key={item.gender || idx} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {item.gender}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs sm:text-sm">
                          {item.count.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs sm:text-sm text-indigo-600">
                          {item.percentage}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* TOP RAÇAS: CANINAS E FELINAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Caninas */}
            <Card className="border-slate-200 shadow-sm overflow-hidden print:border-slate-300 break-inside-avoid">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  Top Raças Caninas mais frequentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="w-[40px] text-center font-bold text-slate-800">
                        #
                      </TableHead>
                      <TableHead className="font-bold text-slate-800">Raça</TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">
                        Pacientes
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topBreedsCanine.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-slate-500">
                          Sem dados
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.topBreedsCanine.map((b, i) => (
                        <TableRow key={b.breed + i} className="hover:bg-slate-50/70">
                          <TableCell className="text-center font-bold text-xs text-slate-400">
                            {i + 1}º
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 text-xs uppercase">
                            {b.breed}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                            {b.count.toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top Felinas */}
            <Card className="border-slate-200 shadow-sm overflow-hidden print:border-slate-300 break-inside-avoid">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  Top Raças Felinas mais frequentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="w-[40px] text-center font-bold text-slate-800">
                        #
                      </TableHead>
                      <TableHead className="font-bold text-slate-800">Raça</TableHead>
                      <TableHead className="font-bold text-slate-800 text-right">
                        Pacientes
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topBreedsFeline.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-slate-500">
                          Sem dados
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.topBreedsFeline.map((b, i) => (
                        <TableRow key={b.breed + i} className="hover:bg-slate-50/70">
                          <TableCell className="text-center font-bold text-xs text-slate-400">
                            {i + 1}º
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 text-xs uppercase">
                            {b.breed}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                            {b.count.toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
