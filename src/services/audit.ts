import pb from '@/lib/pocketbase/client'

export type AuditAction = 'create' | 'update' | 'delete' | 'mark_completed' | 'reopen'
export type AuditModule = 'patients' | 'tutors' | 'clinical_records' | 'returns'

export interface FieldDiff {
  label?: string
  oldValue: any
  newValue: any
}

export interface AuditLogRecord {
  id: string
  user_id?: string
  user_name: string
  user_email?: string
  user_role?: string
  action: AuditAction
  module: AuditModule
  record_id?: string
  record_label?: string
  patient_name?: string
  tutor_name?: string
  changes?: Record<string, FieldDiff>
  details?: string
  created: string
  updated?: string
}

export interface CreateAuditLogParams {
  action: AuditAction
  module: AuditModule
  recordId?: string
  recordLabel?: string
  patientName?: string
  tutorName?: string
  changes?: Record<string, FieldDiff>
  details?: string
}

export interface AuditLogFilters {
  page?: number
  perPage?: number
  userId?: string
  action?: string
  module?: string
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  search?: string
}

export interface AuditLogListResult {
  items: AuditLogRecord[]
  totalItems: number
  totalPages: number
  page: number
  perPage: number
}

// Rótulos amigáveis para campos em diffs
export const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  species: 'Espécie',
  breed: 'Raça',
  weight: 'Peso (kg)',
  gender: 'Sexo',
  birth_date: 'Data de Nascimento',
  pelagem: 'Pelagem',
  microchip: 'Microchip',
  ctrl: 'Código CTRL',
  deceased: 'Óbito',
  status_notes: 'Observações de Status',
  phone: 'Telefone Principal',
  phone_secondary: 'Telefone Secundário',
  email: 'E-mail',
  cpf: 'CPF',
  rg: 'RG',
  cep: 'CEP',
  address: 'Endereço',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'UF',
  indication: 'Indicação',
  additional_info: 'Informações Adicionais',
  description: 'Queixa / Evolução',
  diagnosis: 'Diagnóstico',
  treatment: 'Tratamento Prescrito',
  date: 'Data Prevista / Realizada',
  notes: 'Histórico / Descrição',
  completed: 'Realizado / Concluído',
  tutor_id: 'Tutor',
  patient_id: 'Paciente',
}

export const ACTION_LABELS: Record<
  AuditAction,
  { label: string; badgeVariant: string; colorClass: string }
> = {
  create: {
    label: 'Criou',
    badgeVariant: 'default',
    colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  update: {
    label: 'Alterou',
    badgeVariant: 'secondary',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  delete: {
    label: 'Excluiu',
    badgeVariant: 'destructive',
    colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  mark_completed: {
    label: 'Marcou Realizado',
    badgeVariant: 'outline',
    colorClass: 'bg-green-100 text-green-900 border-green-400 font-bold',
  },
  reopen: {
    label: 'Reabriu',
    badgeVariant: 'outline',
    colorClass: 'bg-amber-100 text-amber-900 border-amber-300 font-medium',
  },
}

export const MODULE_LABELS: Record<AuditModule, { label: string; colorClass: string }> = {
  patients: { label: 'Pacientes', colorClass: 'text-sky-700 bg-sky-50 border-sky-200' },
  tutors: { label: 'Tutores', colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  clinical_records: {
    label: 'Ficha Clínica (Evolução & Prescrição)',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
  },
  returns: {
    label: 'Agenda de Retornos',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-300',
  },
}

export const auditService = {
  /**
   * Grava um log de auditoria no PocketBase de forma síncrona/não-bloqueante.
   * Se falhar, captura o erro e apenas avisa no console (sem derrubar a operação principal).
   */
  log: async (params: CreateAuditLogParams): Promise<void> => {
    try {
      const authUser = pb.authStore.isValid ? (pb.authStore.record as any) : null

      const userName = authUser?.name || authUser?.email || 'Usuário do Sistema'
      const userEmail = authUser?.email || ''
      const userRole = authUser?.role || 'veterinarian'
      const userId = authUser?.id || undefined

      const payload = {
        user_id: userId,
        user_name: userName,
        user_email: userEmail,
        user_role: userRole,
        action: params.action,
        module: params.module,
        record_id: params.recordId || '',
        record_label: params.recordLabel || '',
        patient_name: params.patientName || '',
        tutor_name: params.tutorName || '',
        changes: params.changes || null,
        details: params.details || '',
      }

      await pb.collection('audit_logs').create(payload)
    } catch (err) {
      console.warn('[AuditLog] Falha ao registrar log de auditoria (não-bloqueante):', err)
    }
  },

  /**
   * Calcula o diff entre dois objetos de dados para salvar no JSON de alterações.
   */
  computeDiff: (
    oldData: Record<string, any> | null | undefined,
    newData: Record<string, any> | null | undefined,
    ignoredKeys: string[] = [
      'id',
      'created',
      'updated',
      'collectionId',
      'collectionName',
      'expand',
      'files',
    ],
  ): Record<string, FieldDiff> => {
    const diff: Record<string, FieldDiff> = {}
    if (!oldData && !newData) return diff

    const allKeys = Array.from(
      new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]),
    )

    for (const key of allKeys) {
      if (ignoredKeys.includes(key)) continue

      const oldVal = oldData ? oldData[key] : undefined
      const newVal = newData ? newData[key] : undefined

      // Normalização para comparação simples
      const normOld = oldVal === undefined || oldVal === null ? '' : String(oldVal).trim()
      const normNew = newVal === undefined || newVal === null ? '' : String(newVal).trim()

      if (normOld !== normNew) {
        diff[key] = {
          label: FIELD_LABELS[key] || key,
          oldValue: oldVal ?? null,
          newValue: newVal ?? null,
        }
      }
    }

    return diff
  },

  /**
   * Busca registros de auditoria paginados no servidor com filtros avançados.
   */
  getPaged: async (filters: AuditLogFilters): Promise<AuditLogListResult> => {
    const page = filters.page || 1
    const perPage = filters.perPage || 30
    const filterParts: string[] = []

    if (filters.userId && filters.userId !== 'all') {
      const clean = filters.userId.replace(/"/g, '\\"')
      filterParts.push(`user_id = "${clean}"`)
    }

    if (filters.action && filters.action !== 'all') {
      const clean = filters.action.replace(/"/g, '\\"')
      filterParts.push(`action = "${clean}"`)
    }

    if (filters.module && filters.module !== 'all') {
      const clean = filters.module.replace(/"/g, '\\"')
      filterParts.push(`module = "${clean}"`)
    }

    if (filters.startDate) {
      const startIso = `${filters.startDate} 00:00:00.000Z`
      filterParts.push(`created >= "${startIso}"`)
    }

    if (filters.endDate) {
      const endIso = `${filters.endDate} 23:59:59.999Z`
      filterParts.push(`created <= "${endIso}"`)
    }

    if (filters.search && filters.search.trim()) {
      const clean = filters.search.trim().replace(/"/g, '\\"')
      filterParts.push(
        `(user_name ~ "${clean}" || user_email ~ "${clean}" || patient_name ~ "${clean}" || tutor_name ~ "${clean}" || record_label ~ "${clean}" || details ~ "${clean}")`,
      )
    }

    const filter = filterParts.join(' && ')

    const res = await pb.collection('audit_logs').getList<AuditLogRecord>(page, perPage, {
      filter,
      sort: '-created',
    })

    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
      page: res.page,
      perPage: res.perPage,
    }
  },

  /**
   * Busca todos os usuários cadastrados para alimentar o seletor de filtros.
   */
  getAuditedUsers: async (): Promise<
    { id: string; name: string; email: string; role: string }[]
  > => {
    try {
      const users = await pb.collection('users').getFullList({
        sort: 'name',
        fields: 'id,name,email,role',
      })
      return users.map((u: any) => ({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role || 'veterinarian',
      }))
    } catch (err) {
      console.warn('Erro ao carregar lista de usuários para filtro de auditoria:', err)
      return []
    }
  },
}
