import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Users,
  FileCheck,
  AlertCircle,
  PhoneCall,
  CreditCard,
  FileText,
  RotateCcw,
  ShieldCheck,
  Ban,
} from 'lucide-react'
import type { ComplementaryImportFinalReport } from '@/services/complementary-import-pipeline'

interface ComplementaryImportReportViewProps {
  report: ComplementaryImportFinalReport
  onReset: () => void
}

export function ComplementaryImportReportView({
  report,
  onReset,
}: ComplementaryImportReportViewProps) {
  const { counts, durationMs } = report
  const durationSec = (durationMs / 1000).toFixed(1)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner Principal de Sucesso */}
      <Card className="border-2 border-emerald-500 bg-gradient-to-r from-emerald-500/10 via-white to-emerald-500/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  Importação Complementar Concluída com Sucesso!
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Processamento executado no servidor nativo em {durationSec}s. Dados existentes
                  foram estritamente protegidos.
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white font-mono text-xs w-fit">
              DADOS.TXT Processado
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Grid de Totais de Conferência */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* 1. Linhas lidas */}
        <Card className="border border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-medium">Linhas Lidas</span>
              <FileCheck className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono">
              {counts.linesRead.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-muted-foreground">Total de registros do arquivo</p>
          </CardContent>
        </Card>

        {/* 2. Tutores casados */}
        <Card className="border border-emerald-200 shadow-xs bg-emerald-50/40">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-emerald-900">
              <span className="text-xs font-semibold">Tutores Casados</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-900 font-mono">
              {counts.tutorsMatched.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-emerald-700">Por NUME &gt; import_key</p>
          </CardContent>
        </Card>

        {/* 3. Campos preenchidos */}
        <Card className="border border-indigo-200 shadow-xs bg-indigo-50/40">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-indigo-900">
              <span className="text-xs font-semibold">Campos Preenchidos</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-indigo-900 font-mono">
              {counts.fieldsFilled.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-indigo-700">Auditados (anterior → novo)</p>
          </CardContent>
        </Card>

        {/* 4. Não casados */}
        <Card className="border border-amber-200 shadow-xs bg-amber-50/40">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-xs font-semibold">Não Casados</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-900 font-mono">
              {counts.notMatched.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-amber-700">Nenhum registro novo criado</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento dos Campos Preenchidos */}
      <Card className="border border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-base text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Detalhamento de Preenchimento (TEL3 / Débito)
          </CardTitle>
          <CardDescription className="text-xs">
            Campos que estavam vazios no banco e foram enriquecidos a partir do DADOS.TXT.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
              <PhoneCall className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600 font-medium">Telefone 3 (tel3)</p>
                <p className="text-lg font-bold text-slate-900 font-mono">
                  {counts.tel3Filled.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-slate-500">preenchidos nos tutores</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600 font-medium">Flag de Débito (dbdt_flag)</p>
                <p className="text-lg font-bold text-slate-900 font-mono">
                  {counts.dbdtFilled.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-slate-500">marcados como Débito (DBDT=-1)</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600 font-medium">Texto de Débito (dbtx)</p>
                <p className="text-lg font-bold text-slate-900 font-mono">
                  {counts.dbtxFilled.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-slate-500">observações de débito vinculadas</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-slate-500" />
              <span>Campos já preenchidos preservados intactos (sem sobrescrita):</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {counts.skippedAlreadyFilled.toLocaleString('pt-BR')} ocorrências protegidas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Ações Inferiores */}
      <div className="flex justify-end pt-2">
        <Button onClick={onReset} className="gap-2 shadow-sm font-semibold">
          <RotateCcw className="w-4 h-4" /> Realizar Nova Importação
        </Button>
      </div>
    </div>
  )
}
