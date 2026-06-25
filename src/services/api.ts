import pb from '@/lib/pocketbase/client'

export const api = {
  getPatient: (id: string) => pb.collection('patients').getOne(id, { expand: 'tutor_id' }),
  getPatients: () =>
    pb.collection('patients').getFullList({ expand: 'tutor_id', sort: '-created' }),
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

  getTutors: () => pb.collection('tutors').getFullList({ sort: '-created' }),
  updateTutor: (id: string, data: any) => pb.collection('tutors').update(id, data),
  createTutor: (data: any) => pb.collection('tutors').create(data),

  getClinicalRecords: (patientId: string) =>
    pb
      .collection('clinical_records')
      .getFullList({ filter: `patient_id = "${patientId}"`, sort: '-created' }),
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

  getAppointments: (patientId?: string) => {
    const filter = patientId ? `patient_id = "${patientId}"` : ''
    return pb.collection('appointments').getFullList({ filter, sort: 'date', expand: 'patient_id' })
  },
  updateAppointment: (id: string, data: any) => pb.collection('appointments').update(id, data),
  createAppointment: (data: any) => pb.collection('appointments').create(data),
  deleteAppointment: (id: string) => pb.collection('appointments').delete(id),
}
