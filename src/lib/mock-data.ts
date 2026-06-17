export type ReturnEvent = {
  id: string
  date: string
  activity: string
  status: 'Pendente' | 'Concluído' | 'Nota'
  notes: string
}

export type ClinicalRecord = {
  id: string
  date: string
  weight: string
  symptoms: string
  diagnosis: string
  treatment: string
}

export type Owner = {
  name: string
  cpf: string
  rg: string
  address: string
  neighborhood: string
  city: string
  state: string
  zip: string
  phones: string[]
  email: string
}

export type Patient = {
  id: string
  name: string
  species: string
  breed: string
  gender: 'Macho' | 'Fêmea'
  color: string
  birthDate: string
  isAlive: boolean
  microchip: string
  owner: Owner
  debts: string
  accountNumber: string
  lastVisit: string
  returns: ReturnEvent[]
  clinicalRecords: ClinicalRecord[]
  images: string[]
  photoUrl?: string
}

export const mockPatients: Patient[] = [
  {
    id: '19450',
    name: 'Kiko',
    species: 'Cão',
    breed: 'Lhasa Apso',
    gender: 'Macho',
    color: 'Cinza/Branco',
    birthDate: '2018-11-03',
    isAlive: true,
    microchip: '',
    photoUrl: 'https://img.usecurling.com/p/200/200?q=lhasa%20apso',
    owner: {
      name: 'Zulmira Cavalcante da Silva',
      cpf: '111.222.333-44',
      rg: '12.345.678-9',
      address: 'R. Galdino Mesquita, 212',
      neighborhood: 'Horto Santo Antonio',
      city: 'Jundiaí',
      state: 'SP',
      zip: '13200-000',
      phones: ['4582-7986 RESID.', '99907-8245 ZULMIRA', '99137-3616 ROBERTO'],
      email: 'zulmira.cavalcante@exemplo.com',
    },
    debts: 'DERMATO',
    accountNumber: '19450',
    lastVisit: '2022-12-06',
    returns: [
      { id: '1', date: '2026-01-20', activity: 'VH10+RAIVA+VERMI', status: 'Pendente', notes: '' },
      {
        id: '2',
        date: '2026-03-20',
        activity: 'BRONCHI+GIARDIA+VERMIF',
        status: 'Pendente',
        notes: '',
      },
      {
        id: '3',
        date: '',
        activity: 'FALAR QUE É DA CLIN DR HENRIQUE DERMATO',
        status: 'Nota',
        notes: 'Contato prioritário',
      },
    ],
    clinicalRecords: [
      {
        id: '1',
        date: '2022-12-06',
        weight: '8.5 kg',
        symptoms: 'Coceira intensa nas patas e orelhas.',
        diagnosis: 'Dermatite atópica',
        treatment: 'Apoquel 5.4mg 1x ao dia. Banho com shampoo clorexidina.',
      },
      {
        id: '2',
        date: '2021-05-10',
        weight: '8.2 kg',
        symptoms: 'Rotina',
        diagnosis: 'Saudável',
        treatment: 'Vacina V10 e Raiva aplicadas.',
      },
    ],
    images: [
      'https://img.usecurling.com/p/400/300?q=dog%20paw',
      'https://img.usecurling.com/p/400/300?q=xray%20dog',
    ],
  },
  {
    id: '19451',
    name: 'Mia',
    species: 'Gato',
    breed: 'Siamês',
    gender: 'Fêmea',
    color: 'Creme/Marrom',
    birthDate: '2020-04-15',
    isAlive: true,
    microchip: '98200040583',
    photoUrl: 'https://img.usecurling.com/p/200/200?q=siamese%20cat',
    owner: {
      name: 'Carlos Mendes',
      cpf: '222.333.444-55',
      rg: '23.456.789-0',
      address: 'Av. Paulista, 1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100',
      phones: ['11 98765-4321'],
      email: 'carlos.mendes@exemplo.com',
    },
    debts: '',
    accountNumber: '19451',
    lastVisit: '2023-10-12',
    returns: [
      {
        id: '4',
        date: '2024-10-12',
        activity: 'Vacina V4',
        status: 'Pendente',
        notes: 'Ligar 1 semana antes',
      },
    ],
    clinicalRecords: [
      {
        id: '3',
        date: '2023-10-12',
        weight: '4.1 kg',
        symptoms: 'Espirros',
        diagnosis: 'Rinotraqueíte leve',
        treatment: 'Antibiótico por 7 dias.',
      },
    ],
    images: [],
  },
]

export const summaryStats = {
  totalRegistrations: 21007,
  appointmentsToday: 12,
  newPatientsMonth: 45,
  pendingReturns: 8,
  vaccinesExpiring: 15,
}
