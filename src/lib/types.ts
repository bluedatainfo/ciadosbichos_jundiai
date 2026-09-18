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
  rg?: string
  indication?: string
  city?: string
  state?: string
  neighborhood?: string
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
  ctrl?: string
  import_key?: string
  microchip?: string
  deceased?: boolean
  status_notes?: string
  registration_date?: string
  tutor_id: string
  created: string
  expand?: {
    tutor_id: Tutor
  }
}

export type Vaccine = {
  id: string
  patient_id: string
  name: string
  date?: string
  notes?: string
  created: string
  updated: string
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
  source?: 'internal' | 'public'
  notes: string
  expand?: {
    patient_id: Patient
  }
}

export type TimeInterval = {
  start: string // "08:00"
  end: string // "12:00"
}

export type BusinessHours = {
  id: string
  day_of_week: number // 0 (Domingo) a 6 (Sábado)
  day_name: string
  is_open: boolean
  slot_duration_minutes: number
  intervals: TimeInterval[]
  created: string
  updated: string
}

export type AvailableSlot = {
  time: string
  available: boolean
}

export type AvailableSlotsResponse = {
  date: string
  day_of_week: number
  day_name?: string
  is_open: boolean
  slot_duration_minutes: number
  slots: AvailableSlot[]
  message?: string
}

export type PublicBookingPayload = {
  tutor_name: string
  tutor_phone: string
  tutor_email?: string
  pet_name: string
  pet_species: string
  pet_breed?: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  notes?: string
}

export type PublicBookingResult = {
  success: boolean
  appointment_id: string
  date: string
  time: string
  tutor_name: string
  tutor_phone: string
  pet_name: string
  species: string
  notes?: string
  error?: string
}
