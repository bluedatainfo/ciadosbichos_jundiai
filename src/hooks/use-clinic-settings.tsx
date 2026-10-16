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
const CACHE_KEY = 'vet_clinic_settings_cached'

interface CachedClinicSettings {
  settings: ClinicSettings
  savedAt: number
}

function loadCachedSettings(): ClinicSettings | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedClinicSettings
    if (parsed && parsed.settings && parsed.settings.name) {
      return parsed.settings
    }
  } catch (err) {
    console.warn('Erro ao ler cache de clinic_settings do localStorage:', err)
  }
  return null
}

function saveCachedSettings(settings: ClinicSettings) {
  try {
    if (typeof window !== 'undefined' && settings && settings.name) {
      const data: CachedClinicSettings = {
        settings,
        savedAt: Date.now(),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('Erro ao salvar cache de clinic_settings no localStorage:', err)
  }
}

const initialCached = loadCachedSettings()

const ClinicSettingsContext = createContext<ClinicSettingsContextType>({
  clinicName: initialCached?.name?.trim() || DEFAULT_CLINIC_NAME,
  clinicLogoUrl: initialCached?.logo
    ? pb.files.getURL(initialCached as any, initialCached.logo)
    : null,
  clinicSettings: initialCached,
  loading: !initialCached,
  reloadSettings: async () => {},
})

export function ClinicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(() =>
    loadCachedSettings(),
  )
  const [loading, setLoading] = useState(() => !loadCachedSettings())

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getClinicSettings()
      if (data && data.name) {
        setClinicSettings(data)
        saveCachedSettings(data)
      }
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
  const cachedFallback = loadCachedSettings()
  const clinicName =
    clinicSettings?.name?.trim() || cachedFallback?.name?.trim() || DEFAULT_CLINIC_NAME
  const currentLogo = clinicSettings?.logo || cachedFallback?.logo
  const clinicLogoUrl = currentLogo
    ? pb.files.getURL((clinicSettings || cachedFallback) as any, currentLogo)
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
