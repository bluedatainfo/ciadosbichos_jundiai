import pb from '@/lib/pocketbase/client'
import { EntityType } from '@/lib/import-config'

export interface ImportError {
  row: number
  data: Record<string, any>
  errors: string[]
}

export interface ImportReport {
  success: boolean
  created: number
  failed: number
  errors: ImportError[]
}

async function findTutorByNameOrCpf(identifier: string): Promise<string | null> {
  if (!identifier) return null
  try {
    const filter = `name = "${identifier}" || cpf = "${identifier}"`
    const record = await pb.collection('tutors').getFirstListItem(filter)
    return record.id
  } catch {
    return null
  }
}

async function findPatientByName(name: string): Promise<string | null> {
  if (!name) return null
  try {
    const record = await pb.collection('patients').getFirstListItem(`name = "${name}"`)
    return record.id
  } catch {
    return null
  }
}

export async function processImport(
  entityType: EntityType,
  records: Array<{ data: Record<string, any>; errors: string[] }>,
  onProgress?: (current: number, total: number) => void,
): Promise<ImportReport> {
  const errors: ImportError[] = []
  let created = 0

  for (let i = 0; i < records.length; i++) {
    const { data } = records[i]
    onProgress?.(i + 1, records.length)

    try {
      if (entityType === 'tutors') {
        await pb.collection('tutors').create(data)
        created++
      } else if (entityType === 'patients') {
        const tutorIdentifier = data.tutor_name
        delete data.tutor_name
        if (tutorIdentifier) {
          const tutorId = await findTutorByNameOrCpf(tutorIdentifier)
          if (tutorId) {
            data.tutor_id = tutorId
          }
        }
        await pb.collection('patients').create(data)
        created++
      } else if (entityType === 'appointments') {
        const patientName = data.patient_name
        delete data.patient_name
        if (patientName) {
          const patientId = await findPatientByName(patientName)
          if (patientId) {
            data.patient_id = patientId
          }
        }
        if (!data.patient_id) {
          errors.push({
            row: i + 1,
            data,
            errors: ['Paciente não encontrado para vincular o agendamento'],
          })
          continue
        }
        await pb.collection('appointments').create(data)
        created++
      }
    } catch (err: any) {
      const errMsg = err?.response?.data
        ? Object.entries(err.response.data)
            .map(([k, v]: [string, any]) => `${k}: ${v.message}`)
            .join('; ')
        : err?.message || 'Erro desconhecido'
      errors.push({ row: i + 1, data, errors: [errMsg] })
    }
  }

  return {
    success: errors.length === 0,
    created,
    failed: errors.length,
    errors,
  }
}
