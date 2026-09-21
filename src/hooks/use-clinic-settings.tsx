import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ClinicSettings } from '@/lib/types'
import { api } from '@/services/api'
import pb from '@/lib/pocketbase/client'

interface ClinicSettingsContextType {
  clinicName: string
  clinicLogoUrl: string | null
  clinicSettings: ClinicSettings | null
  loading: boolean
  reloadSettings: () => Promise<void>
}

const DEFAULT_CLINIC_NAME = 'VetSaaS'

const ClinicSettingsContext = createContext<ClinicSettingsContextType>({
  clinicName: DEFAULT_CLINIC_NAME,
  clinicLogoUrl: null,
  clinicSettings: null,
  loading: true,
  reloadSettings: async () => {},
})

export function ClinicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getClinicSettings()
      setClinicSettings(data)
    } catch (err) {
      console.warn('Erro ao carregar configurações da clínica:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Atualizar document.title com o nome da clínica
  const clinicName = clinicSettings?.name?.trim() || DEFAULT_CLINIC_NAME
  const clinicLogoUrl = clinicSettings?.logo
    ? pb.files.getURL(clinicSettings as any, clinicSettings.logo)
    : null

  useEffect(() => {
    if (clinicName) {
      document.title = `${clinicName} - Gestão Veterinária`
    }
  }, [clinicName])

  return (
    <ClinicSettingsContext.Provider
      value={{
        clinicName,
        clinicLogoUrl,
        clinicSettings,
        loading,
        reloadSettings: fetchSettings,
      }}
    >
      {children}
    </ClinicSettingsContext.Provider>
  )
}

export function useClinicSettings() {
  return useContext(ClinicSettingsContext)
}
