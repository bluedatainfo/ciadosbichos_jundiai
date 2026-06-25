export type Tutor = {
  id: string
  name: string
  phone: string
  phone_secondary?: string
  email: string
  cpf: string
  address: string
  cep?: string
  additional_info?: string
}

export type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'veterinarian' | 'attendant'
  avatar?: string
}

export type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  min_stock: number
  created: string
  updated: string
}

export type Patient = {
  id: string
  name: string
  species: string
  breed: string
  birth_date: string
  gender: 'Macho' | 'Fêmea'
  weight: number
  pelagem?: string
  photo?: string
  last_visit?: string
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
  files?: string[]
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
