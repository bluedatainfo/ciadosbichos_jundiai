import { useState, useCallback } from 'react'
import { parseFile, ParseResult } from '@/lib/csv-parser'
import { EntityType, ENTITY_LABELS, FIELD_CONFIGS, validateRow } from '@/lib/import-config'
import { processImport, ImportReport as ImportReportType } from '@/services/import'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileUpload } from '@/components/import/FileUpload'
import { FieldMapping } from '@/components/import/FieldMapping'
import { DataPreview } from '@/components/import/DataPreview'
import { ImportReport } from '@/components/import/ImportReport'
import {
  Users,
  PawPrint,
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type Step = 'select' | 'upload' | 'map' | 'preview' | 'importing' | 'report'

const ENTITY_ICONS = {
  tutors: Users,
  patients: PawPrint,
  appointments: CalendarDays,
}

export default function Import() {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('select')
  const [entityType, setEntityType] = useState<EntityType | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState(0)
  const [report, setReport] = useState<ImportReportType | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name)
      const result = await parseFile(file)
      setParseResult(result)
      if (result.errors.length > 0) {
        toast({ title: 'Aviso', description: result.errors[0], variant: 'destructive' })
        if (result.headers.length === 0) return
      }
      const autoMap: Record<string, string> = {}
      const fields = entityType ? FIELD_CONFIGS[entityType] : []
      fields.forEach((f) => {
        const match = result.headers.find(
          (h) =>
            h.toLowerCase().includes(f.key.toLowerCase()) ||
            h.toLowerCase() === f.label.toLowerCase(),
        )
        if (match) autoMap[f.key] = match
      })
      setMapping(autoMap)
      setStep('map')
    },
    [entityType, toast],
  )

  const handleStartImport = async () => {
    if (!entityType || !parseResult) return
    setStep('importing')
    setProgress(0)

    const validRecords = parseResult.rows.map((row) => validateRow(entityType, row, mapping))
    const goodRecords = validRecords.filter((v) => v.valid)

    const result = await processImport(entityType, goodRecords, (curr, total) => {
      setProgress(Math.round((curr / total) * 100))
    })
    setReport(result)
    setStep('report')
    toast({
      title: result.success ? 'Sucesso!' : 'Importação concluída com avisos',
      description: `${result.created} registros criados, ${result.failed} falhas.`,
    })
  }

  const reset = () => {
    setStep('select')
    setEntityType(null)
    setParseResult(null)
    setFileName('')
    setMapping({})
    setProgress(0)
    setReport(null)
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'select', label: 'Entidade' },
    { key: 'upload', label: 'Arquivo' },
    { key: 'map', label: 'Mapeamento' },
    { key: 'preview', label: 'Prévia' },
    { key: 'report', label: 'Relatório' },
  ]
  const currentStepIdx = steps.findIndex((s) => s.key === step)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-primary" /> Importação de Dados
        </h1>
        <p className="text-muted-foreground mt-1">
          Migre registros do sistema legado (.mdb → CSV) para a plataforma.
        </p>
      </div>

      {step !== 'importing' && (
        <div className="flex items-center gap-2 flex-wrap">
          {steps.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  idx <= currentStepIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-muted-foreground',
                )}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
                {s.label}
              </div>
              {idx < steps.length - 1 && <div className="w-4 h-px bg-slate-300" />}
            </div>
          ))}
        </div>
      )}

      {step === 'select' && (
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => {
            const Icon = ENTITY_ICONS[et]
            return (
              <Card
                key={et}
                onClick={() => {
                  setEntityType(et)
                  setStep('upload')
                }}
                className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all group"
              >
                <CardContent className="flex flex-col items-center gap-3 pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-semibold text-slate-800">{ENTITY_LABELS[et]}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {step === 'upload' && entityType && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Enviar arquivo — {ENTITY_LABELS[entityType]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload onFile={handleFile} fileName={fileName} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('select')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'map' && entityType && parseResult && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Mapeamento de Campos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldMapping
              entityType={entityType}
              headers={parseResult.headers}
              mapping={mapping}
              onMappingChange={(key, value) => setMapping({ ...mapping, [key]: value })}
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep('preview')}
                disabled={Object.keys(mapping).length === 0}
              >
                Prévia <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && entityType && parseResult && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Prévia e Validação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DataPreview entityType={entityType} rows={parseResult.rows} mapping={mapping} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('map')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleStartImport} className="bg-primary">
                Iniciar Importação <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-medium text-slate-700">Processando importação...</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {step === 'report' && report && entityType && (
        <ImportReport report={report} entityType={entityType} onRestart={reset} />
      )}
    </div>
  )
}
