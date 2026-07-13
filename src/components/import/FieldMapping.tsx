import { EntityType, FIELD_CONFIGS } from '@/lib/import-config'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface FieldMappingProps {
  entityType: EntityType
  headers: string[]
  mapping: Record<string, string>
  onMappingChange: (key: string, value: string) => void
}

export function FieldMapping({ entityType, headers, mapping, onMappingChange }: FieldMappingProps) {
  const fields = FIELD_CONFIGS[entityType]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Mapeie as colunas do arquivo para os campos do sistema. Campos com * são obrigatórios.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
              {field.type === 'select' && (
                <Badge variant="outline" className="text-xs">
                  {field.options?.join(' / ')}
                </Badge>
              )}
              {field.type === 'date' && (
                <Badge variant="outline" className="text-xs">
                  Data
                </Badge>
              )}
              {field.type === 'number' && (
                <Badge variant="outline" className="text-xs">
                  Número
                </Badge>
              )}
              {field.type === 'relation' && (
                <Badge variant="outline" className="text-xs bg-blue-50">
                  Vincular
                </Badge>
              )}
            </Label>
            <Select
              value={mapping[field.key] || '_none'}
              onValueChange={(v) => onMappingChange(field.key, v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coluna..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Não mapear —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}
