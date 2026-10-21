import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'

export interface PrescriptionRecord {
  id: string
  patient_id: string
  patient_name: string
  tutor_name?: string
  date: string
  content: string
  attached_to_record?: boolean
  attached_record_id?: string
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
    attached_record_id?: {
      id: string
      files?: string[]
      description?: string
    }
  }
}

export interface CreatePrescriptionData {
  patient_id: string
  patient_name: string
  tutor_name?: string
  date: string
  content: string
  attached_to_record?: boolean
  attached_record_id?: string
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
      expand: 'patient_id.tutor_id,attached_record_id',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
    }
  },

  /**
   * Anexa o PDF gerado diretamente à ficha clínica do paciente (clinical_records)
   * e cria uma nova evolução com a prescrição e o arquivo PDF anexado.
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

  /**
   * Exclusão inteligente do receituário.
   * Se removeAttachmentFromRecord === true e o receituário tiver attached_record_id:
   * busca o registro de ficha clínica vinculado, localiza o arquivo correspondente ao PDF do receituário
   * e remove APENAS aquele arquivo do campo files via PocketBase 'files-'.
   * Mantém intactos todos os demais arquivos do registro.
   * Em seguida exclui o registro de prescriptions e registra tudo na auditoria.
   */
  delete: async (
    prescription: PrescriptionRecord,
    removeAttachmentFromRecord: boolean = false,
  ): Promise<{ prescriptionDeleted: boolean; attachmentRemoved: boolean }> => {
    let attachmentRemoved = false

    // 1. Se solicitado e houver vínculo de ficha clínica, remover apenas o arquivo do receituário
    if (removeAttachmentFromRecord && prescription.attached_record_id) {
      try {
        const clinicalRec = await pb
          .collection('clinical_records')
          .getOne(prescription.attached_record_id)

        const files: string[] = Array.isArray(clinicalRec?.files) ? clinicalRec.files : []

        if (files.length > 0) {
          // Identificar o arquivo pelo padrão receituario_*.pdf ou pelo nome salvo
          const targetFile =
            files.find((f: string) => f.toLowerCase().includes('receituario')) ||
            files.find((f: string) => f.toLowerCase().endsWith('.pdf')) ||
            (files.length === 1 ? files[0] : null)

          if (targetFile) {
            await pb.collection('clinical_records').update(prescription.attached_record_id, {
              'files-': [targetFile],
            })
            attachmentRemoved = true

            // Auditoria da remoção do anexo na ficha clínica
            auditService.log({
              action: 'delete',
              module: 'clinical_records',
              recordId: prescription.attached_record_id,
              recordLabel: `Anexo de receituário removido da ficha — ${prescription.patient_name}`,
              patientName: prescription.patient_name,
              tutorName: prescription.tutor_name || '',
              details: `Arquivo ${targetFile} desanexado da evolução clínica após exclusão do receituário ${prescription.id}.`,
            })
          }
        }
      } catch (attachErr) {
        console.warn('Aviso: falha ao remover arquivo de receituário da ficha clínica:', attachErr)
      }
    }

    // 2. Excluir o registro de prescriptions
    await pb.collection('prescriptions').delete(prescription.id)

    // 3. Registrar auditoria da exclusão do receituário
    auditService.log({
      action: 'delete',
      module: 'prescriptions',
      recordId: prescription.id,
      recordLabel: `Receituário de ${prescription.patient_name} (${prescription.date})`,
      patientName: prescription.patient_name,
      tutorName: prescription.tutor_name || '',
      details: `Receituário excluído do histórico.${
        attachmentRemoved
          ? ' PDF também desanexado da ficha clínica vinculada.'
          : prescription.attached_to_record
            ? ' PDF mantido na ficha clínica.'
            : ''
      }`,
    })

    return {
      prescriptionDeleted: true,
      attachmentRemoved,
    }
  },
}
