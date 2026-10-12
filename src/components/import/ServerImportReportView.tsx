import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  PawPrint,
  Clock,
  FileText,
  Syringe,
  CalendarCheck,
  Download,
  Trash2,
  ShieldCheck,
  Hash,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ServerImportFinalReport } from '@/services/server-import-pipeline'

interface ServerImportReportViewProps {
  report: ServerImportFinalReport
  fileName: string
  onRestart: () => void
}

export function ServerImportReportView({
  report,
  fileName,
  onRestart,
}: ServerImportReportViewProps) {
  const [downloading, setDownloading] = useState(false)
  const isZeroWithoutNume = report.counts.patientsWithoutNume === 0

  const handleDownloadFailures = () => {
    if (!report.failures || report.failures.length === 0) return
    setDownloading(true)
    try {
      const csvContent =
        'Linha,CTRL,Tutor,Animal,Tipo,Erro,Trecho Problemático\n' +
        report.failures
          .map(
            (e) =>
              `"${e.linha}","${e.ctrl || ''}","${(e.tutor || '').replace(/"/g, '""')}","${(e.animal || '').replace(/"/g, '""')}","${e.tipo || 'geral'}","${(e.erro || '').replace(/"/g, '""')}","${(e.trecho || '').replace(/"/g, '""')}"`,
          )
          .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `pendencias_recarga_servidor_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                Resumo da Recarga Oficial no Servidor
              </CardTitle>
              <CardDescription className="text-xs">
                Base zerada previamente e recarregada pelo pipeline nativo de servidor a partir do
                arquivo completo ({fileName || 'arquivo único'}).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1">
                Servidor Nativo
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {report.totalRows.toLocaleString('pt-BR')} linhas processadas
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Header de Status */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {report.success ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-lg text-emerald-950">
                      Recarga Completa Concluída com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      A base de testes foi zerada e todos os dados do arquivo oficial foram
                      importados no servidor.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-lg text-amber-950">
                      Recarga Concluída com {report.failures.length} Pendências
                    </h3>
                    <p className="text-xs text-amber-800">
                      Os registros válidos foram inseridos com sucesso no servidor. Verifique as
                      linhas com pendências abaixo.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs text-slate-600 bg-white">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" /> Tempo total:{' '}
                {report.durationSeconds}s
              </Badge>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
                Linhas: {report.totalRows.toLocaleString('pt-BR')}
              </Badge>
            </div>
          </div>

          {/* PAINEL DE CONFERÊNCIA MANDATÓRIA DE NUME */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isZeroWithoutNume
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/80 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isZeroWithoutNume ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                <Hash className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm">Conferência de Número Oficial (NUME):</h4>
                  {isZeroWithoutNume ? (
                    <Badge className="bg-emerald-600 text-white text-[11px]">
                      ✓ 100% dos Pacientes com NUME Preenchido
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-600 text-white text-[11px]">
                      Atenção: Pacientes com NUME Vazio
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Conferência do arquivo de 12/10: todo paciente cadastrado deve possuir o seu
                  número oficial (NUME) preenchido.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white px-3.5 py-2 rounded-lg border text-center shadow-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Com NUME
                </span>
                <span className="text-base font-black text-emerald-700">
                  {report.counts.patientsWithNume.toLocaleString('pt-BR')}
                </span>
              </div>
              <div
                className={`px-3.5 py-2 rounded-lg border text-center shadow-xs ${
                  isZeroWithoutNume ? 'bg-white' : 'bg-amber-100 border-amber-400'
                }`}
              >
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Sem NUME (Meta: 0)
                </span>
                <span
                  className={`text-base font-black ${
                    isZeroWithoutNume ? 'text-slate-900' : 'text-red-600'
                  }`}
                >
                  {report.counts.patientsWithoutNume.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* PAINEL DE INFORMAÇÕES DO WIPE REALIZADO */}
          {report.wipeSummary && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Limpeza Prévia Executada no Servidor (Wipe)
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Admin <strong>bluedata@bluedatainfo.com.br</strong> preservado
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-white rounded border">
                  <span className="text-[10px] text-slate-500 block">Pacientes apagados</span>
                  <strong className="text-slate-800">
                    {report.wipeSummary.patientsDeleted.toLocaleString('pt-BR')}
                  </strong>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-[10px] text-slate-500 block">Tutores apagados</span>
                  <strong className="text-slate-800">
                    {report.wipeSummary.tutorsDeleted.toLocaleString('pt-BR')}
                  </strong>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-[10px] text-slate-500 block">Prontuários apagados</span>
                  <strong className="text-slate-800">
                    {report.wipeSummary.clinicalDeleted.toLocaleString('pt-BR')}
                  </strong>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-[10px] text-slate-500 block">
                    Outros usuários removidos
                  </span>
                  <strong className="text-slate-800">
                    {report.wipeSummary.usersRemoved.toLocaleString('pt-BR')}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* CARDS DE REGISTROS CRIADOS POR COLEÇÃO */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Registros Criados por Coleção
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Tutores
                  </span>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-blue-900 mt-2">
                  {report.counts.tutorsCreated.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Criados (+ {report.counts.tutorsReused.toLocaleString('pt-BR')} reutilizados)
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Pacientes
                  </span>
                  <PawPrint className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-900 mt-2">
                  {report.counts.patientsCreated.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Criados com campos NUME e import_key
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Prontuários
                  </span>
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-900 mt-2">
                  {report.counts.clinicalCreated.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-amber-600 mt-1">Evoluções com import_hash</p>
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                    Vacinas
                  </span>
                  <Syringe className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl font-black text-purple-900 mt-2">
                  {report.counts.vaccinesCreated.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-purple-600 mt-1">Vacinações gravadas (VAC1-5)</p>
              </div>

              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                    Retornos / Agenda
                  </span>
                  <CalendarCheck className="w-5 h-5 text-teal-600" />
                </div>
                <p className="text-2xl font-black text-teal-900 mt-2">
                  {report.counts.appointmentsCreated.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-teal-600 mt-1">Atendimentos históricos</p>
              </div>
            </div>
          </div>

          {/* LISTAGEM DE FALHAS SE HOUVER */}
          {report.failures && report.failures.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Falhas Registradas ({report.failures.length.toLocaleString('pt-BR')})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadFailures}
                  disabled={downloading}
                  className="gap-1.5 text-xs h-8"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar CSV de Pendências
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border divide-y bg-white">
                {report.failures.slice(0, 50).map((err, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-start gap-3 hover:bg-slate-50">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">Linha {err.linha}</span>
                        {err.ctrl && (
                          <Badge variant="outline" className="text-[10px]">
                            CTRL: {err.ctrl}
                          </Badge>
                        )}
                        {err.tutor && <span className="text-slate-600">Tutor: {err.tutor}</span>}
                        {err.animal && (
                          <span className="text-slate-600">| Animal: {err.animal}</span>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {err.tipo}
                        </Badge>
                      </div>
                      <p className="text-amber-900">{err.erro}</p>
                      {err.trecho && (
                        <div className="p-1 bg-slate-100 rounded text-[11px] font-mono text-slate-700 border">
                          {err.trecho}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AÇÕES FINAIS */}
          <div className="flex items-center justify-between pt-4 border-t flex-wrap gap-3">
            <Button onClick={onRestart} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Realizar Nova Importação / Voltar ao Início
            </Button>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Base oficial 12/10 carregada e pronta para operação no sistema.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
