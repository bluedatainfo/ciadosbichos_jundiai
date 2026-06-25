import pb from '@/lib/pocketbase/client'
import { Patient, Tutor, ClinicalRecord, Appointment } from '@/lib/types'

export const api = {
  getTutors: (searchTerm?: string) => {
    let filter = ''
    if (searchTerm) {
      filter = `name ~ "${searchTerm}" || cpf ~ "${searchTerm}"`
    }
    return pb.collection('tutors').getFullList<Tutor>({ sort: 'name', filter })
  },
  createTutor: (data: Partial<Tutor>) => pb.collection('tutors').create<Tutor>(data),
  updateTutor: (id: string, data: Partial<Tutor>) =>
    pb.collection('tutors').update<Tutor>(id, data),

  getPatients: (searchTerm?: string) => {
    let filter = ''
    if (searchTerm) {
      filter = `name ~ "${searchTerm}" || breed ~ "${searchTerm}" || species ~ "${searchTerm}"`
    }
    return pb
      .collection('patients')
      .getFullList<Patient>({ expand: 'tutor_id', sort: '-created', filter })
  },
  getPatient: (id: string) => pb.collection('patients').getOne<Patient>(id, { expand: 'tutor_id' }),
  createPatient: (data: Partial<Patient>) => pb.collection('patients').create<Patient>(data),
  updatePatient: (id: string, data: Partial<Patient>) =>
    pb.collection('patients').update<Patient>(id, data),

  getClinicalRecords: (patientId: string) =>
    pb
      .collection('clinical_records')
      .getFullList<ClinicalRecord>({ filter: `patient_id = '${patientId}'`, sort: '-created' }),
  createClinicalRecord: (data: Partial<ClinicalRecord>) =>
    pb.collection('clinical_records').create<ClinicalRecord>(data),

  getAppointments: (statusFilter?: string) => {
    let filter = ''
    if (statusFilter && statusFilter !== 'all') {
      filter = `status = '${statusFilter}'`
    }
    return pb
      .collection('appointments')
      .getFullList<Appointment>({ expand: 'patient_id.tutor_id', sort: 'date', filter })
  },
  getPatientAppointments: (patientId: string) =>
    pb.collection('appointments').getFullList<Appointment>({
      filter: `patient_id = '${patientId}'`,
      sort: '-date',
      expand: 'patient_id',
    }),
  createAppointment: (data: Partial<Appointment>) =>
    pb.collection('appointments').create<Appointment>(data),
  updateAppointment: (id: string, data: Partial<Appointment>) =>
    pb.collection('appointments').update<Appointment>(id, data),

  getDashboardStats: async () => {
    const patientsRes = await pb.collection('patients').getList(1, 1)
    const tutorsRes = await pb.collection('tutors').getList(1, 1)

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const appointmentsTodayRes = await pb.collection('appointments').getList(1, 1, {
      filter: `date >= '${todayStr} 00:00:00' && date <= '${todayStr} 23:59:59'`,
    })

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]
    const returnsRes = await pb.collection('appointments').getList(1, 1, {
      filter: `type = 'return' && status = 'scheduled' && date >= '${todayStr} 00:00:00' && date <= '${nextWeekStr} 23:59:59'`,
    })

    return {
      totalPatients: patientsRes.totalItems,
      totalTutors: tutorsRes.totalItems,
      appointmentsToday: appointmentsTodayRes.totalItems,
      upcomingReturnsWeek: returnsRes.totalItems,
    }
  },

  getRecentAppointments: async () => {
    const res = await pb.collection('appointments').getList<Appointment>(1, 5, {
      sort: '-date',
      expand: 'patient_id.tutor_id',
    })
    return res.items
  },
}
