import React from 'react'
import { SyncBalanceSummary } from '@/services/incremental-sync'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Scale,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  Layers,
  ArrowRight,
  Database,
  ArrowLeft,
  Info,
} from 'lucide-react'

interface SyncBalanceReportViewProps {
  balance: SyncBalanceSummary
  fileName: string
  totalRows: number
  rangeStart?: number
  rangeEnd?: number
  onConfirmSync: () => void
  onCancel: () => void
  isApplying?: boolean
}

export function SyncBalanceReportView({
  balance,
  fileName,
  totalRows,
  rangeStart = 1,
  rangeEnd = totalRows,
  onConfirmSync,
  onCancel,
  isApplying = false,
}: SyncBalanceReportViewProps) {
  const totalToUpdate = balance.tutorsToUpdate + balance.patientsToUpdate
  const totalNew =
    balance.tutorsNew +
    balance.patientsNew +
    balance.clinicalNew +
    balance.vaccinesNew +
    balance.appointmentsNew
  const totalIdentical =
    balance.tutorsIdentical +
    balance.patientsIdentical +
    balance.clinicalIdentical +
    balance.vaccinesIdentical +
    balance.appointmentsIdentical
  const totalSystemOnly =
    balance.tutorsOnlyInSystem +
    balance.patientsOnlyInSystem +
    balance.clinicalOnlyInSystem +
    balance.vaccinesOnlyInSystem +
    balance.appointmentsOnlyInSystem

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
              Sincronização Incremental
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {fileName} ({rangeStart}–{rangeEnd} de {totalRows.toLocaleString('pt-BR')} linhas)
            </Badge>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" /> Relatório de Balanceamento Pré-Sincronização
          </h2>
          <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
            Comparação executada registro a registro. Revise os números antes de confirmar a
            gravação. Apenas os registros <strong>novos</strong> ou <strong>com alterações</strong>{' '}
            serão gravados no banco de dados.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={onCancel} disabled={isApplying} size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
          <Button
            onClick={onConfirmSync}
            disabled={isApplying}
            className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm font-semibold"
          >
            Confirmar e Sincronizar <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Regra de Negócio: Vale o do arquivo + Auditoria */}
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-indigo-950">
            Regra permanente ativa: &ldquo;Vale o do arquivo oficial&rdquo;
          </p>
          <p className="text-indigo-800 leading-relaxed">
            Quando um tutor ou paciente já existir no banco mas possuir dados diferentes do novo
            arquivo, os valores do arquivo prevalecerão, restaurando a base oficial. Cada alteração
            será automaticamente gravada no registro de auditoria (anterior &rarr; novo). Registros
            existentes no sistema mas ausentes no arquivo serão mantidos intactos (nunca apagados).
          </p>
        </div>
      </div>

      {/* Visor de Totais Gerais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Idênticos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">
            {totalIdentical.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Serão pulados (sem re-gravação)
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">A Atualizar</span>
            <RefreshCw className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700">
            {totalToUpdate.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Atualizados com auditoria</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Novos</span>
            <PlusCircle className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-700">{totalNew.toLocaleString('pt-BR')}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Criados no banco de dados</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Só no Sistema</span>
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-black text-slate-800">
            {totalSystemOnly.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mantidos sem alteração</p>
        </div>
      </div>

      {/* Detalhamento por Entidade */}
      <Card className="border border-slate-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Balanceamento Detalhado por Coleção
          </CardTitle>
          <CardDescription className="text-xs">
            Distribuição dos registros comparados campo a campo e por hash determinístico.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 border-y uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Coleção / Entidade</th>
                  <th className="py-3 px-4 text-right text-emerald-700">Idênticos (Pular)</th>
                  <th className="py-3 px-4 text-right text-blue-700">A Atualizar (Auditoria)</th>
                  <th className="py-3 px-4 text-right text-purple-700">Novos (Gravar)</th>
                  <th className="py-3 px-4 text-right text-slate-600">
                    Apenas no Sistema (Mantidos)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Tutores
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                    {balance.tutorsIdentical.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                    {balance.tutorsToUpdate.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {balance.tutorsNew.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.tutorsOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pacientes (Animais)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                    {balance.patientsIdentical.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                    {balance.patientsToUpdate.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {balance.patientsNew.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.patientsOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Fichas Clínicas
                    (Evoluções)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                    {balance.clinicalIdentical.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {balance.clinicalNew.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.clinicalOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Histórico de Vacinações
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                    {balance.vaccinesIdentical.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {balance.vaccinesNew.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {balance.vaccinesOnlyInSystem.toLocaleString('pt-BR')}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500" /> Agendamentos & Retornos
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                    {balance.appointmentsIdentical.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {balance.appointmentsNew.toLocaleString('pt-BR')}
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

      {/* Ações Inferiores */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isApplying}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Escolher Outra Faixa ou Arquivo
        </Button>
        <Button
          onClick={onConfirmSync}
          disabled={isApplying}
          className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-md px-6 font-bold"
        >
          Confirmar e Aplicar Sincronização <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
