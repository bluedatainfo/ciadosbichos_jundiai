import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  sanitizeText,
  normalizeSpecies,
  normalizeGender,
  normalizeDeceased,
  extractClinicalHistory,
  extractVaccinesFromRow,
  getTutorDedupeKey,
  getPatientCompositeBaseKey,
} from '@/lib/access-migration-utils'
import { Users, PawPrint, FileText, Syringe, AlertCircle, CheckCircle2, Key } from 'lucide-react'

interface AccessDataPreviewProps {
  rows: Record<string, string>[]
  limit: number
}

export function AccessDataPreview({ rows, limit }: AccessDataPreviewProps) {
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0)

  const previewRows = useMemo(() => {
    return rows.slice(0, Math.min(limit, 50))
  }, [rows, limit])

  const selectedRow = previewRows[selectedRowIdx] || previewRows[0]

  const parsedDetail = useMemo(() => {
    if (!selectedRow) return null
    const tutorNome = sanitizeText(selectedRow.NOME || selectedRow.nome)
    const animalNome = sanitizeText(selectedRow.ANIM || selectedRow.anim)
    const espe = normalizeSpecies(selectedRow.ESPE || selectedRow.espe)
    const sexo = normalizeGender(selectedRow.SEXO || selectedRow.sexo)
    const deceased = normalizeDeceased(
      selectedRow.VIVO || selectedRow.vivo,
      selectedRow.DBTX || selectedRow.dbtx,
    )
    const clinical = extractClinicalHistory(selectedRow.TEXTO || selectedRow.texto)
    const vaccines = extractVaccinesFromRow(selectedRow)

    const tutorDedupeKey = getTutorDedupeKey(
      tutorNome || 'Tutor Não Informado',
      selectedRow.CPF || selectedRow.cpf,
    )
    const compositeBaseKey = getPatientCompositeBaseKey({
      tutorDedupeKey,
      anim: animalNome,
      espe: selectedRow.ESPE || selectedRow.espe,
      nasc: selectedRow.NASC || selectedRow.nasc,
      pela: selectedRow.PELA || selectedRow.pela,
    })

    return {
      tutorNome,
      animalNome,
      tutorDedupeKey,
      compositeBaseKey,
      espe,
      sexo,
      deceased,
      clinical,
      vaccines,
    }
  }, [selectedRow])

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Nenhum dado carregado para visualização.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-blue-50/60 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Formato Access 2.0 Detectado com Sucesso</p>
            <p className="text-blue-700 text-xs">
              Mapeamento automático pronto (CTRL, NOME, ANIM, ESPE, TEXTO, VAC1-5...). Mostrando os
              primeiros {previewRows.length} registros para inspeção.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-white text-blue-700 border-blue-300 font-medium">
          Total no arquivo: {rows.length.toLocaleString('pt-BR')} linhas
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tabela de Amostra */}
        <div className="lg:col-span-2 space-y-2">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center justify-between">
            <span>Amostra de Registros (clique em uma linha para ver detalhes)</span>
            <span className="text-xs text-muted-foreground font-normal">
              Linha selecionada: #{selectedRowIdx + 1}
            </span>
          </h4>

          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[380px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead className="w-[80px]">CTRL</TableHead>
                  <TableHead>Tutor (NOME)</TableHead>
                  <TableHead>Animal (ANIM)</TableHead>
                  <TableHead>Espécie</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => {
                  const ctrl = sanitizeText(row.CTRL || row.ctrl) || '-'
                  const tutor = sanitizeText(row.NOME || row.nome) || '-'
                  const anim = sanitizeText(row.ANIM || row.anim) || '-'
                  const espe = normalizeSpecies(row.ESPE || row.espe)
                  const isDeceased = normalizeDeceased(row.VIVO || row.vivo, row.DBTX || row.dbtx)
                  const isSelected = idx === selectedRowIdx

                  return (
                    <TableRow
                      key={idx}
                      onClick={() => setSelectedRowIdx(idx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-slate-50'
                      }`}
                    >
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-medium">{ctrl}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-800 max-w-[140px] truncate">
                        {tutor}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-[120px] truncate">
                        {anim}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {espe}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {isDeceased ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Óbito
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 hover:bg-green-100">
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detalhes do registro selecionado */}
        <div className="space-y-4">
          <Card className="border shadow-none bg-slate-50/50">
            <CardContent className="p-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Como será importado (#
                {selectedRowIdx + 1})
              </h4>

              {parsedDetail && (
                <div className="space-y-3 text-xs">
                  {/* Tutor */}
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" /> Tutor Desduplicado
                    </p>
                    <p className="text-slate-900 font-medium">
                      {parsedDetail.tutorNome || 'Não informado'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      CPF: {selectedRow.CPF || selectedRow.cpf || 'Não informado'} | Tel:{' '}
                      {selectedRow.TEL1 || selectedRow.tel1 || 'Não informado'}
                    </p>
                    <p className="text-slate-500 text-[11px] truncate">
                      End: {selectedRow.ENDE || selectedRow.ende || ''}{' '}
                      {selectedRow.NUME || selectedRow.nume || ''} -{' '}
                      {selectedRow.BAIR || selectedRow.bair || ''} -{' '}
                      {selectedRow.CIDA || selectedRow.cida || ''}
                    </p>
                  </div>

                  {/* Animal */}
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <PawPrint className="w-3.5 h-3.5 text-emerald-600" /> Paciente (Animal)
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900 font-bold">
                        {parsedDetail.animalNome || 'Sem Nome'}
                      </span>
                      {parsedDetail.deceased && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          Marcado como Óbito
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Espécie: {parsedDetail.espe} | Raça:{' '}
                      {selectedRow.RACA || selectedRow.raca || 'SRD'} | Sexo: {parsedDetail.sexo}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Pelagem: {selectedRow.PELA || selectedRow.pela || '-'} | Chip:{' '}
                      {selectedRow.CHIP || selectedRow.chip || '-'}
                    </p>
                    <p
                      className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1 mt-1 truncate"
                      title={parsedDetail.compositeBaseKey}
                    >
                      <Key className="w-3 h-3 text-primary shrink-0" /> Chave Composta:{' '}
                      {parsedDetail.compositeBaseKey}#1
                    </p>
                  </div>

                  {/* Histórico clínico extraído */}
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5">
                    <p className="font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-600" /> Histórico Clínico
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {parsedDetail.clinical.length} entrada(s)
                      </Badge>
                    </p>
                    {parsedDetail.clinical.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic">Sem anotações no TEXTO.</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
                        {parsedDetail.clinical.map((entry, cIdx) => (
                          <div key={cIdx} className="pt-1 text-[11px] text-slate-700">
                            {entry.rawDateStr && (
                              <span className="font-semibold text-primary mr-1">
                                [{entry.rawDateStr}]
                              </span>
                            )}
                            <span>{entry.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vacinas */}
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5">
                    <p className="font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Syringe className="w-3.5 h-3.5 text-purple-600" /> Histórico de Vacinas
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {parsedDetail.vaccines.length} vacina(s)
                      </Badge>
                    </p>
                    {parsedDetail.vaccines.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic">Nenhuma vacina informada.</p>
                    ) : (
                      <div className="space-y-1">
                        {parsedDetail.vaccines.map((v, vIdx) => (
                          <div
                            key={vIdx}
                            className="text-[11px] bg-slate-50 p-1 rounded flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-800">{v.name}</span>
                            <span className="text-slate-500">{v.rawDate || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
