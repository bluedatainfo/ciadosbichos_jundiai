import { useState, useCallback } from 'react'
import { parseFile, ParseResult } from '@/lib/csv-parser'
import { EntityType, ENTITY_LABELS, FIELD_CONFIGS, validateRow } from '@/lib/import-config'
import { processImport, ImportReport as ImportReportType } from '@/services/import'
import {
  processAccessImport,
  AccessImportProgress,
  AccessImportReport as AccessImportReportType,
} from '@/services/access-import'
import { runAccessDateParserTests } from '@/lib/__tests__/access-date-parser.test'
import { runAccessRateLimitAsyncTests } from '@/lib/__tests__/access-rate-limit.test'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/import/FileUpload'
import { FieldMapping } from '@/components/import/FieldMapping'
import { DataPreview } from '@/components/import/DataPreview'
import { ImportReport } from '@/components/import/ImportReport'
import { AccessDataPreview } from '@/components/import/AccessDataPreview'
import { AccessImportReportView } from '@/components/import/AccessImportReportView'
import {
  Users,
  PawPrint,
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Database,
  Sparkles,
  Info,
  Play,
  FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type ImportMode = 'access_legacy' | 'standard'
type Step = 'select' | 'upload' | 'map' | 'preview' | 'importing' | 'report'

const ENTITY_ICONS = {
  tutors: Users,
  patients: PawPrint,
  appointments: CalendarDays,
}

export default function Import() {
  const { toast } = useToast()
  const [mode, setMode] = useState<ImportMode>('access_legacy')
  const [step, setStep] = useState<Step>('select')
  const [entityType, setEntityType] = useState<EntityType | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Opções para importação do Access
  const [testBatchLimit, setTestBatchLimit] = useState<number>(50) // Padrão: lote pequeno de 50 registros
  const [isFullImport, setIsFullImport] = useState<boolean>(false)
  const [accessProgress, setAccessProgress] = useState<AccessImportProgress | null>(null)
  const [accessReport, setAccessReport] = useState<AccessImportReportType | null>(null)

  // Opções do modo standard
  const [standardProgress, setStandardProgress] = useState(0)
  const [standardReport, setStandardReport] = useState<ImportReportType | null>(null)

  // Detecta se os headers contêm as colunas típicas do Access
  const isAccessHeader = (headers: string[]) => {
    const upper = headers.map((h) => h.toUpperCase())
    const accessCols = ['CTRL', 'NOME', 'ANIM', 'ESPE', 'TEXTO']
    return accessCols.filter((c) => upper.includes(c)).length >= 3
  }

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name)
      const result = await parseFile(file)
      setParseResult(result)

      if (result.errors.length > 0) {
        toast({ title: 'Aviso', description: result.errors[0], variant: 'destructive' })
        if (result.headers.length === 0) return
      }

      // Validação rápida interna do parser de datas e rate limit
      try {
        const testCheck = runAccessDateParserTests()
        if (!testCheck.passed) {
          console.warn(
            'Alerta nos testes do parser de datas:',
            testCheck.results.filter((r) => !r.ok),
          )
        }
        runAccessRateLimitAsyncTests().then((res) => {
          if (!res.passed) {
            console.warn(
              'Alerta nos testes do rate limit/retry:',
              res.results.filter((r) => !r.ok),
            )
          }
        })
      } catch (tErr) {
        console.warn('Erro ao verificar suite de testes:', tErr)
      }

      // Se estamos no modo Access legado OU se detectamos os cabeçalhos do Access
      const detectedAccess = isAccessHeader(result.headers)
      if (mode === 'access_legacy' || detectedAccess) {
        setMode('access_legacy')
        setStep('preview')
        toast({
          title: 'Arquivo Access Detectado',
          description: `${result.rows.length} registros carregados com sucesso.`,
        })
        return
      }

      // Modo padrão (tabelas individuais)
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
    [entityType, mode, toast],
  )

  const handleStartAccessImport = async () => {
    if (!parseResult) return
    setStep('importing')

    const limit = isFullImport ? undefined : testBatchLimit

    try {
      const res = await processAccessImport(parseResult.rows, {
        limit,
        batchSize: 25,
        onProgress: (p) => {
          setAccessProgress(p)
        },
      })

      setAccessReport(res)
      setStep('report')
      toast({
        title: res.failed === 0 ? 'Importação concluída!' : 'Concluída com pendências',
        description: `${res.patientsCreated} pacientes, ${res.tutorsCreated} tutores criados.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err.message || 'Falha ao processar arquivo.',
        variant: 'destructive',
      })
      setStep('preview')
    }
  }

  const handleStartStandardImport = async () => {
    if (!entityType || !parseResult) return
    setStep('importing')
    setStandardProgress(0)

    const validRecords = parseResult.rows.map((row) => validateRow(entityType, row, mapping))
    const goodRecords = validRecords.filter((v) => v.valid)

    const result = await processImport(entityType, goodRecords, (curr, total) => {
      setStandardProgress(Math.round((curr / total) * 100))
    })
    setStandardReport(result)
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
    setStandardProgress(0)
    setStandardReport(null)
    setAccessProgress(null)
    setAccessReport(null)
    setIsFullImport(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-primary" /> Importação & Migração de Dados
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe arquivos do sistema legado Access 2.0 (tabela única) ou arquivos CSV padrão.
        </p>
      </div>

      {step === 'select' && (
        <div className="space-y-6">
          {/* Card Principal: Migração do Access 2.0 */}
          <Card
            onClick={() => {
              setMode('access_legacy')
              setStep('upload')
            }}
            className="cursor-pointer border-2 border-primary/40 hover:border-primary hover:shadow-lg transition-all bg-gradient-to-r from-primary/5 via-white to-transparent p-2 group"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-md">
                  <Database className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      Migração do Sistema Legado (Access 2.0)
                    </h3>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Importa o arquivo delimitado com tabela única contendo colunas{' '}
                    <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono text-primary font-semibold">
                      NOME, ANIM, ESPE, NASC, PELA, TEXTO, VAC1-5...
                    </code>
                    . Cria cada paciente de forma individual por linha com chave composta única,
                    desduplicação inteligente de tutores, extração cronológica do histórico clínico
                    individualizado e vacinas.
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                    <strong>Suporta teste com lote pequeno (~50 registros)</strong> antes da base
                    completa de 21.000+.
                  </p>
                </div>
              </div>
              <Button className="shrink-0 gap-2 shadow-sm group-hover:translate-x-1 transition-transform">
                Iniciar Migração <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Seção secundária: importações manuais por tabela */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Ou selecione para importar tabelas individuais em formato CSV genérico:
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => {
                const Icon = ENTITY_ICONS[et]
                return (
                  <Card
                    key={et}
                    onClick={() => {
                      setMode('standard')
                      setEntityType(et)
                      setStep('upload')
                    }}
                    className="cursor-pointer border hover:border-slate-400 hover:shadow-sm transition-all"
                  >
                    <CardContent className="flex flex-col items-center gap-3 pt-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-slate-600" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{ENTITY_LABELS[et]}</p>
                      <span className="text-xs text-muted-foreground">CSV individual</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {mode === 'access_legacy' ? (
                <>
                  <Database className="w-5 h-5 text-primary" /> Enviar Arquivo Exportado do Access
                  2.0 (.csv ou .txt)
                </>
              ) : (
                `Enviar arquivo — ${entityType ? ENTITY_LABELS[entityType] : ''}`
              )}
            </CardTitle>
            {mode === 'access_legacy' && (
              <CardDescription className="text-xs">
                Selecione o arquivo exportado como texto delimitado por vírgula (ex:{' '}
                <code>BD_TESTE.csv</code> ou <code>BD_TESTE.txt</code>).
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload onFile={handleFile} fileName={fileName} />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('select')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo MAP (somente modo standard) */}
      {step === 'map' && mode === 'standard' && entityType && parseResult && (
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

      {/* Passo PREVIEW (Modo Access Legado) */}
      {step === 'preview' && mode === 'access_legacy' && parseResult && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Prévia da Migração & Configuração do
              Lote
            </CardTitle>
            <CardDescription>
              Valide como os dados dos tutores, animais e atendimentos foram interpretados antes de
              gravar no banco de dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AccessDataPreview rows={parseResult.rows} limit={testBatchLimit} />

            {/* Configuração de Lote de Teste */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="flex items-start gap-2.5">
                <FlaskConical className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-amber-900">
                    Modo de Teste com Lote Pequeno (Recomendado)
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Para garantir total segurança e verificar a consistência dos dados, você pode
                    importar primeiro apenas um lote de teste (ex: 50 registros) antes de processar
                    os 21.000+ registros completos.
                  </p>
                </div>
              </div>

              <RadioGroup
                value={isFullImport ? 'full' : String(testBatchLimit)}
                onValueChange={(val) => {
                  if (val === 'full') {
                    setIsFullImport(true)
                  } else {
                    setIsFullImport(false)
                    setTestBatchLimit(parseInt(val, 10))
                  }
                }}
                className="grid gap-2 sm:grid-cols-3 pt-2"
              >
                <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border">
                  <RadioGroupItem value="50" id="opt-50" />
                  <Label htmlFor="opt-50" className="text-xs font-medium cursor-pointer">
                    <strong>Testar Lote Pequeno (50 linhas)</strong>
                    <span className="block text-[11px] text-muted-foreground">
                      Ideal para conferência rápida
                    </span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border">
                  <RadioGroupItem value="200" id="opt-200" />
                  <Label htmlFor="opt-200" className="text-xs font-medium cursor-pointer">
                    <strong>Lote Intermediário (200 linhas)</strong>
                    <span className="block text-[11px] text-muted-foreground">
                      Teste mais abrangente
                    </span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border">
                  <RadioGroupItem value="full" id="opt-full" />
                  <Label htmlFor="opt-full" className="text-xs font-medium cursor-pointer">
                    <strong>
                      Base Completa ({parseResult.rows.length.toLocaleString()} linhas)
                    </strong>
                    <span className="block text-[11px] text-muted-foreground">
                      Processamento de todo o arquivo
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Escolher Outro Arquivo
              </Button>
              <Button onClick={handleStartAccessImport} className="bg-primary gap-2 shadow-md">
                <Play className="w-4 h-4" />
                {isFullImport
                  ? `Iniciar Importação Completa (${parseResult.rows.length.toLocaleString()} linhas)`
                  : `Iniciar Importação do Lote de Teste (${testBatchLimit} linhas)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo PREVIEW (Modo Standard) */}
      {step === 'preview' && mode === 'standard' && entityType && parseResult && (
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
              <Button onClick={handleStartStandardImport} className="bg-primary">
                Iniciar Importação <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo IMPORTING */}
      {step === 'importing' && (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg text-slate-800">
                {mode === 'access_legacy'
                  ? 'Processando migração em lotes...'
                  : 'Processando importação...'}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {mode === 'access_legacy'
                  ? 'Desduplicando tutores, gerando chave composta dos animais e vinculando históricos clínicos e vacinas a cada paciente individual.'
                  : 'Gravando registros no banco de dados.'}
              </p>
            </div>

            <div className="w-full max-w-md space-y-2">
              <Progress
                value={mode === 'access_legacy' ? accessProgress?.percent || 0 : standardProgress}
                className="w-full h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {mode === 'access_legacy'
                    ? accessProgress?.statusMessage || 'Iniciando...'
                    : `${standardProgress}% concluído`}
                </span>
                <span className="font-semibold">
                  {mode === 'access_legacy'
                    ? `${accessProgress?.percent || 0}%`
                    : `${standardProgress}%`}
                </span>
              </div>
            </div>

            {mode === 'access_legacy' && accessProgress && (
              <div className="grid grid-cols-5 gap-2 w-full max-w-xl mt-4 text-center">
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-blue-700">{accessProgress.tutorsCreated}</p>
                  <p className="text-[10px] text-slate-500">Tutores</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-emerald-700">{accessProgress.patientsCreated}</p>
                  <p className="text-[10px] text-slate-500">Pacientes</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-amber-700">
                    {accessProgress.clinicalEntriesCreated}
                  </p>
                  <p className="text-[10px] text-slate-500">Evoluções</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-purple-700">{accessProgress.vaccinesCreated}</p>
                  <p className="text-[10px] text-slate-500">Vacinas</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-teal-700">
                    {accessProgress.appointmentsCreated || 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Retornos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Passo REPORT */}
      {step === 'report' && (
        <>
          {mode === 'access_legacy' && accessReport ? (
            <AccessImportReportView report={accessReport} onRestart={reset} />
          ) : mode === 'standard' && standardReport && entityType ? (
            <ImportReport report={standardReport} entityType={entityType} onRestart={reset} />
          ) : null}
        </>
      )}
    </div>
  )
}
