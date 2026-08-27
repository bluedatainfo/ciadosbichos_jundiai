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
} from '@/lib/types'

export const api = {
  // Configurações de Horários de Atendimento
  getBusinessHours: () =>
    pb.collection('business_hours').getFullList<BusinessHours>({
      sort: 'day_of_week',
    }),
  updateBusinessHours: (id: string, data: Partial<BusinessHours>) =>
    pb.collection('business_hours').update<BusinessHours>(id, data),

  // Agendamento Online Público
  getAvailableSlots: async (dateStr: string): Promise<AvailableSlotsResponse> => {
    return pb.send<AvailableSlotsResponse>('/api/public-booking/available-slots', {
      method: 'GET',
      query: { date: dateStr },
    })
  },
  createPublicBooking: async (data: PublicBookingPayload): Promise<PublicBookingResult> => {
    return pb.send<PublicBookingResult>('/api/public-booking/create', {
      method: 'POST',
      body: data,
    })
  },
  getPatient: (id: string) => pb.collection('patients').getOne<Patient>(id, { expand: 'tutor_id' }),
  getPatients: (search?: string) => {
    const filter = search
      ? `name ~ "${search}" || breed ~ "${search}" || species ~ "${search}"`
      : ''
    return pb.collection('patients').getFullList<Patient>({
      filter,
      expand: 'tutor_id',
      sort: '-created',
    })
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
  deletePatient: (id: string) => pb.collection('patients').delete(id),

  getTutors: (search?: string) => {
    const filter = search ? `name ~ "${search}" || cpf ~ "${search}"` : ''
    return pb.collection('tutors').getFullList<Tutor>({
      filter,
      sort: '-created',
    })
  },
  updateTutor: (id: string, data: any) => pb.collection('tutors').update(id, data),
  createTutor: (data: any) => pb.collection('tutors').create(data),

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
      .getFullList<Appointment>({ filter, sort: 'date', expand: 'patient_id.tutor_id' })
  },
  updateAppointment: (id: string, data: any) => pb.collection('appointments').update(id, data),
  createAppointment: (data: any) => pb.collection('appointments').create(data),
  deleteAppointment: (id: string) => pb.collection('appointments').delete(id),

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
