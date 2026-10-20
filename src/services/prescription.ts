import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'

export interface PrescriptionRecord {
  id: string
  patient_id: string
  patient_name: string
  tutor_name?: string
  date: string
  content: string
  created: string
  updated: string
  expand?: {
    patient_id?: {
      id: string
      name: string
      tutor_id?: string
      expand?: {
        tutor_id?: {
          id: string
          name: string
        }
      }
    }
  }
}

export interface CreatePrescriptionData {
  patient_id: string
  patient_name: string
  tutor_name?: string
  date: string
  content: string
}

export const prescriptionService = {
  /**
   * Salva o histórico do receituário gerado na coleção 'prescriptions'
   */
  create: async (data: CreatePrescriptionData): Promise<PrescriptionRecord> => {
    return pb.collection('prescriptions').create<PrescriptionRecord>(data)
  },

  /**
   * Lista o histórico recente de receituários
   */
  getList: async (
    page = 1,
    perPage = 20,
  ): Promise<{ items: PrescriptionRecord[]; totalItems: number }> => {
    const res = await pb.collection('prescriptions').getList<PrescriptionRecord>(page, perPage, {
      sort: '-created',
      expand: 'patient_id.tutor_id',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
    }
  },

  /**
   * Anexa o PDF gerado diretamente à ficha clínica do paciente (clinical_records)
   * Se já houver um registro de atendimento recente para a mesma data, anexa a ele;
   * caso contrário, cria uma nova evolução com a prescrição e o arquivo PDF anexado.
   * Em seguida, registra o log na auditoria.
   */
  attachToClinicalHistory: async (
    patientId: string,
    patientName: string,
    tutorName: string,
    pdfBlob: Blob,
    pdfFileName: string,
    content: string,
    dateStr: string,
  ): Promise<{ recordId: string; createdNew: boolean }> => {
    const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' })

    // Cria uma evolução clínica com o documento anexado
    const formData = new FormData()
    formData.append('patient_id', patientId)
    formData.append(
      'description',
      `Receituário gerado em ${dateStr}. Documento oficial timbrado anexado.`,
    )
    formData.append('diagnosis', 'Prescrição Médica Veterinária')
    formData.append('treatment', content)
    formData.append('files', pdfFile)

    const newRecord = await pb.collection('clinical_records').create(formData)

    // Auditoria
    auditService.log({
      action: 'create',
      module: 'clinical_records',
      recordId: newRecord.id,
      recordLabel: `Receituário anexado — ${patientName} (${dateStr})`,
      patientName,
      tutorName,
      details: `Receituário oficial timbrado anexado à ficha clínica com o arquivo ${pdfFileName}.`,
    })

    return {
      recordId: newRecord.id,
      createdNew: true,
    }
  },
}
