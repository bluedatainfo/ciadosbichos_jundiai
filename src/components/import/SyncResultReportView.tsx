import React, { useState } from 'react'
import { SyncResultReport, SyncProgress } from '@/services/incremental-sync'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  Database,
} from 'lucide-react'

interface SyncResultReportViewProps {
  report: SyncResultReport
  onRestart: () => void
  onContinueNextRange?: () => void
  nextRangeSuggested?: { start: number; end: number } | null
}

export function SyncResultReportView({
  report,
  onRestart,
  onContinueNextRange,
  nextRangeSuggested,
}: SyncResultReportViewProps) {
  const { applied, balance, durationSeconds, failures, totalRows } = report
  const [showFailures, setShowFailures] = useState(false)

  const handleDownloadFailuresCSV = () => {
    if (failures.length === 0) return
    const csvContent =
      'Linha,CTRL,Tutor,Animal,Tipo,Erro,Trecho\n' +
      failures
        .map(
          (f) =>
            `"${f.linha}","${f.ctrl || ''}","${(f.tutor || '').replace(/"/g, '""')}","${(f.animal || '').replace(/"/g, '""')}","${f.tipo}","${f.erro.replace(/"/g, '""')}","${(f.trecho || '').replace(/"/g, '""')}"`,
        )
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `pendencias_sincronizacao_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner Principal de Sucesso */}
      <Card className="border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-transparent shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Sincronização Concluída com Sucesso!
                  </h2>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    Base Oficial Atualizada
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  As diferenças foram gravadas e as substituições foram devidamente registradas no
                  módulo de Auditoria conforme a regra oficial.
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Duração: {durationSeconds}s
                  </span>
                  <span>•</span>
                  <span>Total analisado: {totalRows.toLocaleString('pt-BR')} linhas</span>
                  <span>•</span>
                  <span className="font-semibold text-indigo-700">
                    {applied.auditsLogged} logs de auditoria gravados
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {nextRangeSuggested && onContinueNextRange && (
                <Button
                  onClick={onContinueNextRange}
                  className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm font-semibold"
                >
                  Sincronizar Próxima Faixa ({nextRangeSuggested.start}–{nextRangeSuggested.end}){' '}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" onClick={onRestart} size="sm">
                <RotateCcw className="w-4 h-4 mr-1.5" /> Nova Sincronização
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartões com Resumo da Aplicação */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tutores Gravados
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {(applied.tutorsCreated + applied.tutorsUpdated).toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {applied.tutorsCreated} novos • {applied.tutorsUpdated} atualizados •{' '}
            {applied.tutorsSkipped} pulados
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pacientes Gravados
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {(applied.patientsCreated + applied.patientsUpdated).toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {applied.patientsCreated} novos • {applied.patientsUpdated} atualizados •{' '}
            {applied.patientsSkipped} pulados
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Histórico Clínico
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-purple-700">
              +{applied.clinicalCreated.toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {applied.clinicalCreated} novas fichas • {applied.clinicalSkipped} idênticas
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Vacinas e Retornos
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-teal-700">
              +{(applied.vaccinesCreated + applied.appointmentsCreated).toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {applied.vaccinesCreated} vacinas • {applied.appointmentsCreated} retornos
          </p>
        </div>
      </div>

      {/* Relatório Comparativo Final */}
      <Card className="border border-slate-200 bg-white shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Balanço Consolidado da Sincronização
          </CardTitle>
          <CardDescription className="text-xs">
            Resultado real comparado com o balanceamento prévio.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 border-y uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Entidade</th>
                  <th className="py-3 px-4 text-right text-emerald-700">Idênticos (Pulados)</th>
                  <th className="py-3 px-4 text-right text-blue-700">Atualizados no Banco</th>
                  <th className="py-3 px-4 text-right text-purple-700">Novos Criados</th>
                  <th className="py-3 px-4 text-right text-slate-500">Mantidos no Sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">Tutores</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                    {applied.tutorsSkipped.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 font-bold">
                    {applied.tutorsUpdated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-bold">
                    {applied.tutorsCreated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.tutorsOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">Pacientes</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                    {applied.patientsSkipped.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 font-bold">
                    {applied.patientsUpdated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-bold">
                    {applied.patientsCreated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.patientsOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">Fichas Clínicas</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                    {applied.clinicalSkipped.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-bold">
                    +{applied.clinicalCreated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.clinicalOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">Vacinas</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                    {applied.vaccinesSkipped.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-bold">
                    +{applied.vaccinesCreated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.vaccinesOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    Agendamentos / Retornos
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                    {applied.appointmentsSkipped.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-bold">
                    +{applied.appointmentsCreated.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.appointmentsOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Falhas eventuais registradas */}
      {failures.length > 0 && (
        <Card className="border border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Pendências de Gravação ({failures.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadFailuresCSV}
                  className="text-xs gap-1.5 h-7"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar CSV de Pendências
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFailures(!showFailures)}
                  className="text-xs text-amber-800 h-7"
                >
                  {showFailures ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs text-amber-800">
              Estas pendências podem ser reprocessadas posteriormente usando o botão
              &ldquo;Reprocessar Falhas&rdquo;.
            </CardDescription>
          </CardHeader>
          {showFailures && (
            <CardContent className="pt-2">
              <div className="max-h-56 overflow-y-auto divide-y rounded-lg border bg-white text-xs">
                {failures.map((f, idx) => (
                  <div key={idx} className="p-2.5 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">Linha {f.linha}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {f.tipo}
                      </Badge>
                      {f.tutor && <span className="text-slate-600">Tutor: {f.tutor}</span>}
                      {f.animal && <span className="text-slate-600">Animal: {f.animal}</span>}
                    </div>
                    <p className="text-red-700 text-[11px]">{f.erro}</p>
                    {f.trecho && (
                      <p className="font-mono text-[10px] text-slate-600 bg-slate-50 p-1 rounded truncate">
                        {f.trecho}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Ações Finais */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onRestart}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar à Tela Inicial de Importação
        </Button>
        {nextRangeSuggested && onContinueNextRange && (
          <Button
            onClick={onContinueNextRange}
            className="bg-primary hover:bg-primary/90 text-white gap-2 font-bold shadow-md"
          >
            Continuar para Linhas {nextRangeSuggested.start}–{nextRangeSuggested.end}{' '}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
