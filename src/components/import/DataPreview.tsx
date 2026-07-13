import { EntityType, FIELD_CONFIGS, validateRow } from '@/lib/import-config'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface DataPreviewProps {
  entityType: EntityType
  rows: Record<string, string>[]
  mapping: Record<string, string>
  maxPreview?: number
}

export function DataPreview({ entityType, rows, mapping, maxPreview = 20 }: DataPreviewProps) {
  const fields = FIELD_CONFIGS[entityType]
  const previewRows = rows.slice(0, maxPreview)

  const validated = previewRows.map((row) => validateRow(entityType, row, mapping))
  const validCount = validated.filter((v) => v.valid).length
  const invalidCount = validated.length - validCount

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="font-medium text-green-700">{validCount} válidos</span>
        </div>
        {invalidCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="font-medium text-red-700">
              {invalidCount} com erro{previewRows.length < rows.length ? ' (preview)' : ''}
            </span>
          </div>
        )}
        {previewRows.length < rows.length && (
          <Badge variant="outline" className="text-xs">
            Mostrando {previewRows.length} de {rows.length} linhas
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[40px]">#</TableHead>
              {fields.map((f) => (
                <TableHead key={f.key}>{f.label}</TableHead>
              ))}
              <TableHead className="w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, idx) => {
              const v = validated[idx]
              return (
                <TableRow key={idx} className={v.valid ? '' : 'bg-red-50/40'}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  {fields.map((f) => {
                    const col = mapping[f.key]
                    return (
                      <TableCell key={f.key} className="text-sm max-w-[180px] truncate">
                        {col ? row[col] || '-' : '-'}
                      </TableCell>
                    )
                  })}
                  <TableCell>
                    {v.valid ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        {v.errors[0]}
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
  )
}
