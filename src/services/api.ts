import pb from '@/lib/pocketbase/client'
import type {
  Appointment,
  Patient,
  Tutor,
  ClinicalRecord,
  BusinessHours,
  AvailableSlotsResponse,
  PublicBookingPayload,
  PublicBookingResult,
  ClinicSettings,
} from '@/lib/types'

export const api = {
  // Configurações da Clínica
  getClinicSettings: async (): Promise<ClinicSettings | null> => {
    try {
      const records = await pb.collection('clinic_settings').getList<ClinicSettings>(1, 1, {
        sort: 'created',
      })
      return records.items[0] || null
    } catch (e) {
      console.warn('Erro ao buscar configurações da clínica:', e)
      return null
    }
  },
  updateClinicSettings: async (
    id: string,
    data: FormData | Partial<ClinicSettings>,
  ): Promise<ClinicSettings> => {
    return pb.collection('clinic_settings').update<ClinicSettings>(id, data)
  },
  createClinicSettings: async (
    data: FormData | Partial<ClinicSettings>,
  ): Promise<ClinicSettings> => {
    return pb.collection('clinic_settings').create<ClinicSettings>(data)
  },
  getClinicLogoUrl: (record: ClinicSettings | null | undefined): string | null => {
    if (!record || !record.logo) return null
    return pb.files.getURL(record as any, record.logo)
  },

  // Configurações de Horários de Atendimento
  getBusinessHours: () =>
    pb.collection('business_hours').getFullList<BusinessHours>({
      sort: 'day_of_week',
    }),
  updateBusinessHours: (id: string, data: Partial<BusinessHours>) =>
    pb.collection('business_hours').update<BusinessHours>(id, data),

  // Agendamento Online Público
  getAvailableSlots: async (dateStr: string): Promise<AvailableSlotsResponse> => {
    return pb.send<AvailableSlotsResponse>('/backend/v1/public-booking/available-slots', {
      method: 'GET',
      query: { date: dateStr },
    })
  },
  createPublicBooking: async (data: PublicBookingPayload): Promise<PublicBookingResult> => {
    return pb.send<PublicBookingResult>('/backend/v1/public-booking/create', {
      method: 'POST',
      body: data,
    })
  },
  getPatient: (id: string) => pb.collection('patients').getOne<Patient>(id, { expand: 'tutor_id' }),
  getPatients: (search?: string) => {
    const clean = search?.trim().replace(/"/g, '\\"') || ''
    const filter = clean
      ? `name ~ "${clean}" || breed ~ "${clean}" || species ~ "${clean}" || tutor_id.name ~ "${clean}"`
      : ''
    return pb.collection('patients').getFullList<Patient>({
      filter,
      expand: 'tutor_id',
      sort: '-created',
    })
  },
  getPatientsPaged: async (options?: {
    page?: number
    perPage?: number
    search?: string
    species?: string
    sort?: string
  }) => {
    const page = options?.page || 1
    const perPage = options?.perPage || 50
    const filterParts: string[] = []

    if (options?.search?.trim()) {
      const clean = options.search.trim().replace(/"/g, '\\"')
      filterParts.push(
        `(name ~ "${clean}" || breed ~ "${clean}" || species ~ "${clean}" || tutor_id.name ~ "${clean}")`,
      )
    }

    if (options?.species?.trim() && options.species !== 'all') {
      const cleanSpecies = options.species.trim().replace(/"/g, '\\"')
      filterParts.push(`species = "${cleanSpecies}"`)
    }

    const filter = filterParts.join(' && ')
    const sort = options?.sort || '-created'

    return pb.collection('patients').getList<Patient>(page, perPage, {
      filter,
      expand: 'tutor_id',
      sort,
    })
  },
  getPatientsCount: async (search?: string, species?: string) => {
    const filterParts: string[] = []
    if (search?.trim()) {
      const clean = search.trim().replace(/"/g, '\\"')
      filterParts.push(
        `(name ~ "${clean}" || breed ~ "${clean}" || species ~ "${clean}" || tutor_id.name ~ "${clean}")`,
      )
    }
    if (species?.trim() && species !== 'all') {
      const cleanSpecies = species.trim().replace(/"/g, '\\"')
      filterParts.push(`species = "${cleanSpecies}"`)
    }
    const res = await pb.collection('patients').getList(1, 1, {
      filter: filterParts.join(' && '),
      fields: 'id',
    })
    return res.totalItems
  },
  updatePatient: (id: string, data: any) => {
    const formData = new FormData()
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key])
      }
    }
    return pb.collection('patients').update(id, formData)
  },
  createPatient: (data: any) => pb.collection('patients').create(data),
  deletePatient: async (id: string) => {
    // Buscar antes de excluir para salvar detalhes na auditoria
    let patientData: any = null
    try {
      patientData = await pb.collection('patients').getOne(id, { expand: 'tutor_id' })
    } catch {
      /* intentionally ignored */
    }
    const res = await pb.collection('patients').delete(id)
    if (patientData) {
      const { auditService } = await import('@/services/audit')
      auditService.log({
        action: 'delete',
        module: 'patients',
        recordId: id,
        recordLabel: patientData.name || 'Paciente',
        patientName: patientData.name || '',
        tutorName: patientData.expand?.tutor_id?.name || '',
        details: `Exclusão do paciente ${patientData.name || id} (${patientData.species || ''} / ${patientData.breed || ''})`,
      })
    }
    return res
  },

  getTutors: (search?: string) => {
    const clean = search?.trim().replace(/"/g, '\\"') || ''
    const filter = clean ? `name ~ "${clean}" || cpf ~ "${clean}" || phone ~ "${clean}"` : ''
    return pb.collection('tutors').getFullList<Tutor>({
      filter,
      sort: '-created',
    })
  },
  getTutorsPaged: async (options?: {
    page?: number
    perPage?: number
    search?: string
    sort?: string
  }) => {
    const page = options?.page || 1
    const perPage = options?.perPage || 50
    let filter = ''

    if (options?.search?.trim()) {
      const clean = options.search.trim().replace(/"/g, '\\"')
      filter = `name ~ "${clean}" || cpf ~ "${clean}" || phone ~ "${clean}" || email ~ "${clean}"`
    }

    const sort = options?.sort || '-created'

    return pb.collection('tutors').getList<Tutor>(page, perPage, {
      filter,
      sort,
    })
  },
  getTutorsCount: async (search?: string) => {
    let filter = ''
    if (search?.trim()) {
      const clean = search.trim().replace(/"/g, '\\"')
      filter = `name ~ "${clean}" || cpf ~ "${clean}" || phone ~ "${clean}" || email ~ "${clean}"`
    }
    const res = await pb.collection('tutors').getList(1, 1, {
      filter,
      fields: 'id',
    })
    return res.totalItems
  },
  searchTutorsForSelect: (search?: string) => {
    const clean = search?.trim().replace(/"/g, '\\"') || ''
    const filter = clean ? `name ~ "${clean}" || phone ~ "${clean}"` : ''
    return pb.collection('tutors').getList<Tutor>(1, 50, {
      filter,
      sort: 'name',
    })
  },
  updateTutor: (id: string, data: any) => pb.collection('tutors').update(id, data),
  createTutor: (data: any) => pb.collection('tutors').create(data),
  deleteTutor: async (id: string) => {
    let tutorData: any = null
    try {
      tutorData = await pb.collection('tutors').getOne(id)
    } catch {
      /* intentionally ignored */
    }
    const res = await pb.collection('tutors').delete(id)
    if (tutorData) {
      const { auditService } = await import('@/services/audit')
      auditService.log({
        action: 'delete',
        module: 'tutors',
        recordId: id,
        recordLabel: tutorData.name || 'Tutor',
        tutorName: tutorData.name || '',
        details: `Exclusão do tutor ${tutorData.name || id} (CPF: ${tutorData.cpf || '-'}, Tel: ${tutorData.phone || '-'})`,
      })
    }
    return res
  },

  getClinicalRecords: (patientId: string) =>
    pb
      .collection('clinical_records')
      .getFullList<ClinicalRecord>({ filter: `patient_id = "${patientId}"`, sort: '-created' }),
  createClinicalRecord: (data: any) => {
    const formData = new FormData()
    for (const key in data) {
      if (key === 'files' && Array.isArray(data[key])) {
        data[key].forEach((file: File) => formData.append('files', file))
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key])
      }
    }
    return pb.collection('clinical_records').create(formData)
  },
  updateClinicalRecord: (id: string, data: any) => {
    const formData = new FormData()
    for (const key in data) {
      if (key === 'files' && Array.isArray(data[key])) {
        data[key].forEach((file: File) => formData.append('files', file))
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key])
      }
    }
    return pb.collection('clinical_records').update<ClinicalRecord>(id, formData)
  },
  deleteClinicalRecord: async (id: string) => {
    let recordData: any = null
    try {
      recordData = await pb
        .collection('clinical_records')
        .getOne(id, { expand: 'patient_id.tutor_id' })
    } catch {
      /* intentionally ignored */
    }
    const res = await pb.collection('clinical_records').delete(id)
    if (recordData) {
      const { auditService } = await import('@/services/audit')
      auditService.log({
        action: 'delete',
        module: 'clinical_records',
        recordId: id,
        recordLabel: `Evolução clínica de ${recordData.expand?.patient_id?.name || id}`,
        patientName: recordData.expand?.patient_id?.name || '',
        tutorName: recordData.expand?.patient_id?.expand?.tutor_id?.name || '',
        details: `Exclusão de evolução clínica. Diagnóstico: ${recordData.diagnosis || '-'} | Tratamento: ${recordData.treatment || '-'}`,
      })
    }
    return res
  },

  getAppointments: (
    params?: string | { patientId?: string; status?: string; startDate?: Date; endDate?: Date },
  ) => {
    const filterParts: string[] = []
    if (typeof params === 'string') {
      if (params && params !== 'all') filterParts.push(`patient_id = "${params}"`)
    } else if (params) {
      if (params.patientId && params.patientId !== 'all')
        filterParts.push(`patient_id = "${params.patientId}"`)
      if (params.status && params.status !== 'all') filterParts.push(`status = "${params.status}"`)
      if (params.startDate) {
        const start = params.startDate.toISOString().split('T')[0] + ' 00:00:00.000Z'
        filterParts.push(`date >= "${start}"`)
      }
      if (params.endDate) {
        const end = params.endDate.toISOString().split('T')[0] + ' 23:59:59.999Z'
        filterParts.push(`date <= "${end}"`)
      }
    }
    const filter = filterParts.join(' && ')
    return pb
      .collection('appointments')
      .getFullList<Appointment>({ filter, sort: '-date', expand: 'patient_id.tutor_id' })
  },
  updateAppointment: (id: string, data: any) => pb.collection('appointments').update(id, data),
  createAppointment: (data: any) => pb.collection('appointments').create(data),
  deleteAppointment: (id: string) => pb.collection('appointments').delete(id),

  getVaccines: (patientId: string) =>
    pb.collection('vaccines').getFullList<import('@/lib/types').Vaccine>({
      filter: `patient_id = "${patientId}"`,
      sort: '-date',
    }),
  createVaccine: (data: any) => pb.collection('vaccines').create(data),
  updateVaccine: (id: string, data: Partial<import('@/lib/types').Vaccine>) =>
    pb.collection('vaccines').update<import('@/lib/types').Vaccine>(id, data),
  deleteVaccine: (id: string) => pb.collection('vaccines').delete(id),

  getDashboardStats: async () => {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const startOfDay = `${dateStr} 00:00:00.000Z`
    const endOfDay = `${dateStr} 23:59:59.999Z`

    const [tutorsRes, patientsRes, appointmentsRes, inventoryRes] = await Promise.all([
      pb.collection('tutors').getList(1, 1),
      pb.collection('patients').getList(1, 1),
      pb
        .collection('appointments')
        .getList(1, 1, { filter: `date >= "${startOfDay}" && date <= "${endOfDay}"` }),
      pb.collection('inventory').getList(1, 1, { filter: `quantity < min_stock` }),
    ])

    return {
      totalPatients: patientsRes.totalItems,
      totalTutors: tutorsRes.totalItems,
      appointmentsToday: appointmentsRes.totalItems,
      lowStockCount: inventoryRes.totalItems,
    }
  },

  getRecentAppointments: async (): Promise<Appointment[]> => {
    const res = await pb
      .collection('appointments')
      .getList(1, 5, { sort: '-created', expand: 'patient_id.tutor_id' })
    return res.items as unknown as Appointment[]
  },
}
