import React, { useState, useRef } from 'react'
import {
  RefreshCw,
  Upload,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Database,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  importFailuresService,
  ImportFailureRecord,
  ReprocessProgress,
  ReprocessReport,
} from '@/services/import-failures'
import { useToast } from '@/hooks/use-toast'

interface ReprocessFailuresModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFailures?: ImportFailureRecord[]
  rawRows?: Record<string, string>[] | null
  onFailuresResolved?: (recoveredCount: number) => void
}

export function ReprocessFailuresModal({
  open,
  onOpenChange,
  initialFailures = [],
  rawRows,
  onFailuresResolved,
}: ReprocessFailuresModalProps) {
  const { toast } = useToast()

  // Estado das falhas
  const [failures, setFailures] = useState<ImportFailureRecord[]>(initialFailures)
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState<ReprocessProgress | null>(null)
  const [report, setReport] = useState<ReprocessReport | null>(null)

  // Referência para cancelamento/pausa voluntária
  const cancelRequestedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sincronizar quando as falhas iniciais mudarem
  React.useEffect(() => {
    if (initialFailures && initialFailures.length > 0) {
      setFailures(initialFailures)
    }
  }, [initialFailures])

  // Tratar upload de CSV de pendências (ex: pendencias_importacao_access_*.csv)
  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingCSV(true)
    try {
      const text = await file.text()
      const res = await importFailuresService.importFailuresFromCSV(text)

      toast({
        title: 'CSV de Falhas Importado com Sucesso',
        description: `${res.imported.toLocaleString('pt-BR')} falhas gravadas no banco de dados para reprocessamento.`,
      })

      // Recarregar falhas pendentes do banco
      const pendingList = await importFailuresService.getAllPendingFailures()
      if (pendingList.length > 0) {
        setFailures(pendingList)
      }

      // Notificar o componente pai para atualizar contadores no cabeçalho
      if (onFailuresResolved) {
        onFailuresResolved(0)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar CSV de pendências',
        description: err.message || 'Verifique o formato do arquivo.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingCSV(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Iniciar Reprocesso
  const handleStartReprocess = async () => {
    if (!rawRows || rawRows.length === 0) {
      toast({
        title: 'Arquivo Original Necessário',
        description:
          'Selecione o arquivo da base original (.csv) na tela de importação para que o sistema possa reler os dados das linhas que falharam.',
        variant: 'destructive',
      })
      return
    }

    if (failures.length === 0) {
      toast({
        title: 'Nenhuma falha para reprocessar',
        description: 'Todas as falhas registradas já foram resolvidas.',
      })
      return
    }

    cancelRequestedRef.current = false
    setIsProcessing(true)
    setIsPaused(false)
    setReport(null)

    try {
      const rep = await importFailuresService.reprocessFailures(failures, rawRows, {
        itemDelayMs: 200, // Throttling 200ms
        maxRetries: 5,
        onProgress: (p) => {
          setProgress(p)
        },
        shouldCancel: () => cancelRequestedRef.current,
      })

      setReport(rep)

      // Atualizar lista local de falhas restantes
      if (rep.failuresRemaining.length > 0) {
        setFailures(rep.failuresRemaining)
      } else {
        setFailures([])
      }

      if (onFailuresResolved && rep.recovered > 0) {
        onFailuresResolved(rep.recovered)
      }

      toast({
        title:
          rep.remaining === 0
            ? 'Reprocesso Concluído com 100% de Sucesso!'
            : 'Reprocesso Finalizado',
        description: `${rep.recovered.toLocaleString('pt-BR')} registros recuperados e gravados com sucesso.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro durante o reprocesso',
        description: err.message || 'Falha inesperada ao regravar pendências.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Interromper / Pausar
  const handlePause = () => {
    cancelRequestedRef.current = true
    setIsPaused(true)
    toast({
      title: 'Reprocesso Interrompido',
      description: 'O processo será pausado após a gravação da linha atual. O estado foi mantido.',
    })
  }

  // Baixar CSV com falhas restantes
  const handleDownloadRemaining = () => {
    if (!report || report.failuresRemaining.length === 0) return
    const csvContent =
      'Linha,CTRL,Tutor,Animal,Tipo,Erro,Trecho Problemático\n' +
      report.failuresRemaining
        .map(
          (e) =>
            `"${e.linha}","${e.ctrl || ''}","${(e.tutor || '').replace(/"/g, '""')}","${(e.animal || '').replace(/"/g, '""')}","${e.tipo || 'geral'}","${e.erro.replace(/"/g, '""')}","${(e.trecho || '').replace(/"/g, '""')}"`,
        )
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `falhas_restantes_reprocesso_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            <DialogTitle className="text-xl font-bold text-slate-900">
              Reprocessamento Inteligente de Falhas
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600">
            Regravação exclusiva dos registros que falharam por limite de requisições (Too Many
            Requests), aplicando throttling (pausa de 200ms) e retry automático com backoff
            exponencial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Aviso Visível sobre o Arquivo Original da Base */}
          {!rawRows || rawRows.length === 0 ? (
            <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">
                  Atenção: Arquivo original da base necessário para a releitura das linhas
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Para que a releitura das linhas funcione durante o reprocessamento, o arquivo
                  original da base (ex: <code>BD_TESTE.csv</code>) precisa estar carregado na tela
                  de importação. Você pode carregar o CSV de falhas agora para gravar as pendências
                  no banco e, em seguida, carregar o arquivo original na tela de importação antes de
                  clicar em Reprocessar.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Arquivo original carregado na memória:{' '}
                <strong>{rawRows.length.toLocaleString('pt-BR')} linhas</strong> prontas para a
                releitura de dados.
              </span>
            </div>
          )}

          {/* Status Geral das Falhas */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">
                  Falhas Registradas para Reprocesso:
                </span>
                <Badge
                  variant={failures.length > 0 ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {failures.length.toLocaleString('pt-BR')} pendência(s)
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {failures.length === 0
                  ? 'Envie o arquivo CSV de pendências (pendencias_importacao_access_*.csv) para popular o banco de dados.'
                  : rawRows
                    ? `Arquivo original carregado na memória (${rawRows.length.toLocaleString('pt-BR')} linhas). Pronto para reprocessar.`
                    : 'Aviso: Envie ou mantenha o arquivo original da base carregado na tela para permitir a releitura dos dados.'}
              </p>
            </div>

            {/* Ações de Importar CSV de Pendências */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadCSV}
                accept=".csv,.txt"
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingCSV || isProcessing}
                className="text-xs gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploadingCSV ? 'Importando CSV...' : 'Carregar CSV de Falhas'}
              </Button>
            </div>
          </div>

          {/* Seção Durante o Processamento */}
          {isProcessing && progress && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                  {progress.statusMessage}
                </span>
                <span className="font-bold text-primary">{progress.percent}%</span>
              </div>

              <Progress value={progress.percent} className="h-2.5 w-full" />

              {progress.retrying && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Limite de requisições detectado. Aguardando {progress.retryWaitSec}s para nova
                    tentativa (tentativa {progress.retryAttempt}/5)...
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2 bg-white rounded border">
                  <p className="font-bold text-slate-700 text-sm">
                    {progress.current} / {progress.total}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Processadas</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                  <p className="font-bold text-emerald-700 text-sm">+{progress.recovered}</p>
                  <p className="text-[10px] text-emerald-600 uppercase">Recuperadas</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border">
                  <p className="font-bold text-slate-600 text-sm">{progress.remaining}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Restantes</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handlePause}
                  className="text-xs gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" /> Interromper Reprocesso
                </Button>
              </div>
            </div>
          )}

          {/* Relatório Final do Reprocesso */}
          {report && (
            <Card className="border border-emerald-200 bg-emerald-50/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-emerald-950 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Relatório do Reprocesso Concluído
                  </CardTitle>
                  <Badge variant="outline" className="bg-white text-xs">
                    <Clock className="w-3 h-3 mr-1 text-slate-400" />
                    Tempo: {report.durationSeconds}s
                  </Badge>
                </div>
                <CardDescription className="text-xs text-emerald-800">
                  Resumo das entradas clínicas e agendamentos regravados com controle de taxa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-white rounded-lg border border-emerald-100">
                    <p className="text-2xl font-black text-slate-800">{report.processed}</p>
                    <p className="text-xs text-slate-500">Processadas</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <p className="text-2xl font-black text-emerald-600">+{report.recovered}</p>
                    <p className="text-xs text-emerald-700 font-semibold">
                      Recuperadas com Sucesso
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-2xl font-black text-slate-600">{report.remaining}</p>
                    <p className="text-xs text-slate-500">Restantes</p>
                  </div>
                </div>

                {/* Motivos reais se restarem */}
                {report.remaining > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2">
                    <h5 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Motivo real das falhas não recuperadas:
                    </h5>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                      {Object.entries(report.reasons).map(([reason, count]) => (
                        <li key={reason}>
                          <strong>{reason}:</strong> {count} ocorrência(s)
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadRemaining}
                        className="text-xs gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar Falhas Restantes (CSV)
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Listagem de Amostra das Falhas Registradas */}
          {!isProcessing && failures.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Prévia das Pendências Registradas ({failures.length}):
                </span>
                <span className="text-[11px] text-muted-foreground">Exibindo até 5 primeiras</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border divide-y bg-white text-xs">
                {failures.slice(0, 5).map((f, idx) => (
                  <div key={idx} className="p-2.5 space-y-1 hover:bg-slate-50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">Linha {f.linha}</span>
                      <Badge variant="destructive" className="text-[10px]">
                        {f.tipo === 'clinical_entry'
                          ? 'Entrada Clínica'
                          : f.tipo === 'appointment'
                            ? 'Agendamento'
                            : 'Falha'}
                      </Badge>
                      {f.ctrl && (
                        <Badge variant="outline" className="text-[10px]">
                          CTRL: {f.ctrl}
                        </Badge>
                      )}
                      {f.tutor && <span className="text-slate-600">Tutor: {f.tutor}</span>}
                      {f.animal && <span className="text-slate-600">| Animal: {f.animal}</span>}
                    </div>
                    <p className="text-red-700 text-[11px]">{f.erro}</p>
                    {f.trecho && (
                      <div className="bg-slate-100 p-1 rounded font-mono text-[10px] text-slate-700 truncate">
                        Trecho: {f.trecho}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé / Botão de Ação */}
          <div className="flex items-center justify-between pt-4 border-t flex-wrap gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Fechar
            </Button>

            <Button
              onClick={handleStartReprocess}
              disabled={isProcessing || failures.length === 0 || !rawRows}
              className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm"
            >
              <Play className="w-4 h-4" />
              {isProcessing
                ? 'Reprocessando...'
                : `Reprocessar Falhas (${failures.length.toLocaleString('pt-BR')})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
