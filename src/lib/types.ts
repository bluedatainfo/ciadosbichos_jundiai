export type Tutor = {
  id: string
  name: string
  phone: string
  email: string
  cpf: string
  address: string
}

export type Patient = {
  id: string
  name: string
  species: string
  breed: string
  birth_date: string
  gender: 'Macho' | 'Fêmea'
  weight: number
  tutor_id: string
  created: string
  expand?: {
    tutor_id: Tutor
  }
}

export type ClinicalRecord = {
  id: string
  patient_id: string
  description: string
  diagnosis: string
  treatment: string
  created: string
}

export type Appointment = {
  id: string
  patient_id: string
  date: string
  type: 'return' | 'vaccine' | 'surgery' | 'consultation'
  status: 'scheduled' | 'completed' | 'cancelled'
  notes: string
  expand?: {
    patient_id: Patient
  }
}
