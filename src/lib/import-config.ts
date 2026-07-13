export interface FieldDef {
  key: string
  label: string
  required: boolean
  type: 'text' | 'date' | 'number' | 'select' | 'relation'
  options?: string[]
  relationLabel?: string
}

export type EntityType = 'tutors' | 'patients' | 'appointments'

export const ENTITY_LABELS: Record<EntityType, string> = {
  tutors: 'Tutores',
  patients: 'Pacientes',
  appointments: 'Agendamentos',
}

export const FIELD_CONFIGS: Record<EntityType, FieldDef[]> = {
  tutors: [
    { key: 'name', label: 'Nome', required: true, type: 'text' },
    { key: 'phone', label: 'Telefone', required: false, type: 'text' },
    { key: 'email', label: 'Email', required: false, type: 'text' },
    { key: 'cpf', label: 'CPF', required: false, type: 'text' },
    { key: 'address', label: 'Endereço', required: false, type: 'text' },
    { key: 'cep', label: 'CEP', required: false, type: 'text' },
  ],
  patients: [
    { key: 'name', label: 'Nome', required: true, type: 'text' },
    { key: 'species', label: 'Espécie', required: false, type: 'text' },
    { key: 'breed', label: 'Raça', required: false, type: 'text' },
    { key: 'birth_date', label: 'Data de Nascimento', required: false, type: 'date' },
    { key: 'gender', label: 'Sexo', required: false, type: 'select', options: ['Macho', 'Fêmea'] },
    { key: 'weight', label: 'Peso (kg)', required: false, type: 'number' },
    { key: 'pelagem', label: 'Pelagem', required: false, type: 'text' },
    {
      key: 'tutor_name',
      label: 'Nome do Tutor (para vincular)',
      required: false,
      type: 'relation',
      relationLabel: 'Nome ou CPF do Tutor',
    },
  ],
  appointments: [
    { key: 'date', label: 'Data', required: true, type: 'date' },
    {
      key: 'type',
      label: 'Tipo',
      required: false,
      type: 'select',
      options: ['return', 'vaccine', 'surgery', 'consultation'],
    },
    {
      key: 'status',
      label: 'Status',
      required: false,
      type: 'select',
      options: ['scheduled', 'completed', 'cancelled'],
    },
    { key: 'notes', label: 'Observações', required: false, type: 'text' },
    {
      key: 'patient_name',
      label: 'Nome do Paciente (para vincular)',
      required: false,
      type: 'relation',
      relationLabel: 'Nome do Paciente',
    },
  ],
}

export function parseDate(value: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const formats: RegExp[] = [
    /^(\d{4})-(\d{2})-(\d{2})/,
    /^(\d{2})\/(\d{2})\/(\d{4})/,
    /^(\d{2})-(\d{2})-(\d{4})/,
  ]
  for (const fmt of formats) {
    const m = trimmed.match(fmt)
    if (m) {
      if (fmt === formats[0]) {
        return new Date(trimmed).toISOString()
      }
      const day = m[1]
      const month = m[2]
      const year = m[3]
      const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  }
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}

export function validateRow(
  entityType: EntityType,
  row: Record<string, string>,
  mapping: Record<string, string>,
): { valid: boolean; errors: string[]; data: Record<string, any> } {
  const errors: string[] = []
  const data: Record<string, any> = {}
  const fields = FIELD_CONFIGS[entityType]

  for (const field of fields) {
    const sourceCol = mapping[field.key]
    const rawValue = sourceCol ? (row[sourceCol] || '').trim() : ''

    if (field.required && !rawValue) {
      errors.push(`${field.label} é obrigatório`)
      continue
    }
    if (!rawValue) continue

    if (field.type === 'date') {
      const parsed = parseDate(rawValue)
      if (parsed) {
        data[field.key] = parsed
      } else {
        errors.push(`${field.label}: data inválida "${rawValue}"`)
      }
    } else if (field.type === 'number') {
      const num = parseFloat(rawValue.replace(',', '.'))
      if (!isNaN(num)) {
        data[field.key] = num
      } else {
        errors.push(`${field.label}: valor numérico inválido "${rawValue}"`)
      }
    } else if (field.type === 'select') {
      const lower = rawValue.toLowerCase()
      const match = field.options?.find((o) => o.toLowerCase() === lower)
      if (match) {
        data[field.key] = match
      } else {
        const mapLabel: Record<string, string> = {
          return: 'return',
          retorno: 'return',
          vaccine: 'vaccine',
          vacina: 'vaccine',
          surgery: 'surgery',
          cirurgia: 'surgery',
          consultation: 'consultation',
          consulta: 'consultation',
          scheduled: 'scheduled',
          agendado: 'scheduled',
          completed: 'completed',
          concluido: 'completed',
          concluído: 'completed',
          cancelled: 'cancelled',
          cancelado: 'cancelled',
        }
        const mapped = mapLabel[lower]
        if (mapped) {
          data[field.key] = mapped
        } else {
          errors.push(
            `${field.label}: valor inválido "${rawValue}". Permitidos: ${field.options?.join(', ')}`,
          )
        }
      }
    } else if (field.type === 'relation') {
      data[field.key] = rawValue
    } else {
      data[field.key] = rawValue
    }
  }

  return { valid: errors.length === 0, errors, data }
}
