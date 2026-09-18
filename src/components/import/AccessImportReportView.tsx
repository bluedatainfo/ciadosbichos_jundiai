import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  PawPrint,
  Clock,
  FileText,
  Syringe,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AccessImportReport } from '@/services/access-import'

interface AccessImportReportViewProps {
  report: AccessImportReport
  onRestart: () => void
}

export function AccessImportReportView({ report, onRestart }: AccessImportReportViewProps) {
  const successRate =
    report.totalProcessed > 0
      ? Math.round(((report.totalProcessed - report.failed) / report.totalProcessed) * 100)
      : 0

  const handleDownloadErrors = () => {
    if (!report.errors || report.errors.length === 0) return
    const csvContent =
      'Linha,CTRL,Tutor,Animal,Erro\n' +
      report.errors
        .map(
          (e) =>
            `"${e.row}","${e.ctrl || ''}","${(e.tutorName || '').replace(/"/g, '""')}","${(e.animalName || '').replace(/"/g, '""')}","${e.error.replace(/"/g, '""')}"`,
        )
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `erros_importacao_access_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Relatório de Migração — Legado Access 2.0
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {report.failed === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-7 h-7" />
                  <div>
                    <h3 className="font-bold text-lg text-green-800">
                      Lote importado com sucesso!
                    </h3>
                    <p className="text-xs text-green-600">
                      Todos os registros válidos foram processados.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                  <div>
                    <h3 className="font-bold text-lg text-amber-800">
                      Importação concluída com pendências
                    </h3>
                    <p className="text-xs text-amber-700">
                      Alguns registros tiveram erros específicos.
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
              <Badge variant={successRate === 100 ? 'default' : 'secondary'} className="text-xs">
                Taxa de sucesso: {successRate}%
              </Badge>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Tutores
                </span>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-900 mt-2">{report.tutorsCreated}</p>
              <p className="text-xs text-blue-600 mt-1">
                Criados (+ {report.tutorsReused} desduplicados)
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Pacientes
                </span>
                <PawPrint className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-900 mt-2">{report.patientsCreated}</p>
              <p className="text-xs text-emerald-600 mt-1">
                {report.patientsSkipped > 0
                  ? `Criados (${report.patientsSkipped} já existentes mantidos)`
                  : 'Criados (1 por linha do lote)'}
              </p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  Histórico Clínico
                </span>
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900 mt-2">
                {report.clinicalEntriesCreated}
              </p>
              <p className="text-xs text-amber-600 mt-1">Evoluções extraídas por data</p>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                  Vacinas
                </span>
                <Syringe className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-purple-900 mt-2">{report.vaccinesCreated}</p>
              <p className="text-xs text-purple-600 mt-1">Vacinações gravadas (VAC1-5)</p>
            </div>
          </div>

          {/* Erros / Falhas */}
          {report.errors && report.errors.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Falhas Registradas ({report.errors.length})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadErrors}
                  className="gap-1.5 text-xs h-8"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Relatório de Falhas
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y bg-white">
                {report.errors.slice(0, 50).map((err, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-start gap-3 hover:bg-slate-50">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Linha {err.row}</span>
                        {err.ctrl && (
                          <Badge variant="outline" className="text-[10px]">
                            CTRL: {err.ctrl}
                          </Badge>
                        )}
                        {err.tutorName && (
                          <span className="text-slate-600">Tutor: {err.tutorName}</span>
                        )}
                        {err.animalName && (
                          <span className="text-slate-600">| Animal: {err.animalName}</span>
                        )}
                      </div>
                      <p className="text-red-700">{err.error}</p>
                    </div>
                  </div>
                ))}
                {report.errors.length > 50 && (
                  <div className="p-2 text-xs text-center text-muted-foreground bg-slate-50">
                    ... e mais {report.errors.length - 50} erros adicionais
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
              ✓ Nenhuma falha de gravação no banco foi reportada para este lote.
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button onClick={onRestart} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Fazer Outra Importação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
