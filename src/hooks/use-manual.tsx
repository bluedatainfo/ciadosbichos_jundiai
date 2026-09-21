import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { MANUAL_MODULES, ManualModule, getManualModuleByPath } from '@/data/manual'

interface ManualContextType {
  isOpen: boolean
  currentModuleId: string
  currentModule: ManualModule
  openManual: (moduleId?: string) => void
  closeManual: () => void
  toggleManual: () => void
  selectModule: (moduleId: string) => void
}

const ManualContext = createContext<ManualContextType | undefined>(undefined)

export function ManualProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState<string>('visao-geral')

  // Ao mudar de rota enquanto fechado, sincroniza o módulo com a rota
  useEffect(() => {
    const mod = getManualModuleByPath(location.pathname)
    if (!isOpen) {
      setActiveModuleId(mod.id)
    }
  }, [location.pathname, isOpen])

  const openManual = useCallback(
    (moduleId?: string) => {
      if (moduleId) {
        setActiveModuleId(moduleId)
      } else {
        const mod = getManualModuleByPath(location.pathname)
        setActiveModuleId(mod.id)
      }
      setIsOpen(true)
    },
    [location.pathname],
  )

  const closeManual = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleManual = useCallback(() => {
    if (isOpen) {
      closeManual()
    } else {
      openManual()
    }
  }, [isOpen, openManual, closeManual])

  const selectModule = useCallback((moduleId: string) => {
    setActiveModuleId(moduleId)
  }, [])

  // Listener global da tecla F1
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault() // Impede a ajuda padrão do navegador
        toggleManual()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleManual])

  const currentModule =
    MANUAL_MODULES.find((m) => m.id === activeModuleId) ||
    getManualModuleByPath(location.pathname) ||
    MANUAL_MODULES[0]

  return (
    <ManualContext.Provider
      value={{
        isOpen,
        currentModuleId: currentModule.id,
        currentModule,
        openManual,
        closeManual,
        toggleManual,
        selectModule,
      }}
    >
      {children}
    </ManualContext.Provider>
  )
}

export function useManual() {
  const context = useContext(ManualContext)
  if (!context) {
    throw new Error('useManual deve ser utilizado dentro de um ManualProvider')
  }
  return context
}
