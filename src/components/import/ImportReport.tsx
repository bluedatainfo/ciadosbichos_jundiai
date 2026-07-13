import { CheckCircle2, XCircle, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EntityType, ENTITY_LABELS } from '@/lib/import-config'
import { ImportReport as ImportReportType } from '@/services/import'

interface ImportReportProps {
  report: ImportReportType
  entityType: EntityType
  onRestart: () => void
}

export function ImportReport({ report, entityType, onRestart }: ImportReportProps) {
  const total = report.created + report.failed
  const successRate = total > 0 ? Math.round((report.created / total) * 100) : 0

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Relatório de Importação — {ENTITY_LABELS[entityType]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            {report.success ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold">Importação concluída com sucesso</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
                <span className="font-semibold">Importação concluída com avisos</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-green-50 p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{report.created}</p>
              <p className="text-sm text-green-600">Registros criados</p>
            </div>
            <div className="rounded-lg border bg-red-50 p-4 text-center">
              <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">{report.failed}</p>
              <p className="text-sm text-red-600">Falhas</p>
            </div>
            <div className="rounded-lg border bg-blue-50 p-4 text-center">
              <FileSpreadsheet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">{total}</p>
              <p className="text-sm text-blue-600">Total processado</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Taxa de sucesso</span>
            <Badge variant={successRate === 100 ? 'default' : 'secondary'} className="text-sm">
              {successRate}%
            </Badge>
          </div>

          {report.errors && report.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Detalhes das falhas
              </h3>
              <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                {report.errors.slice(0, 50).map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 px-3 py-2 text-sm">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-slate-600">
                      {typeof err === 'string'
                        ? err
                        : `Linha ${err.row ?? idx + 1}: ${err.message ?? 'Erro desconhecido'}`}
                    </span>
                  </div>
                ))}
                {report.errors.length > 50 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                    ... e mais {report.errors.length - 50} erro(s)
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onRestart} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Nova importação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
