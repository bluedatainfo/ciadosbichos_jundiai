import pb from '@/lib/pocketbase/client'
import { Patient, Tutor, ClinicalRecord, Appointment } from '@/lib/types'

export const api = {
  getTutors: () => pb.collection('tutors').getFullList<Tutor>({ sort: 'name' }),
  createTutor: (data: Partial<Tutor>) => pb.collection('tutors').create<Tutor>(data),
  updateTutor: (id: string, data: Partial<Tutor>) =>
    pb.collection('tutors').update<Tutor>(id, data),

  getPatients: () =>
    pb.collection('patients').getFullList<Patient>({ expand: 'tutor_id', sort: '-created' }),
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

  getAppointments: () =>
    pb
      .collection('appointments')
      .getFullList<Appointment>({ expand: 'patient_id.tutor_id', sort: 'date' }),
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
}
