import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: any
  isAuthenticated: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(pb.authStore.isValid ? pb.authStore.record : null)
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(pb.authStore.isValid ? record : null)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      const refreshWithRetry = async (retries = 2, delayMs = 1500) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await pb.collection('users').authRefresh()
            return
          } catch (err: any) {
            const status = err?.status || err?.response?.status
            // Apenas 401 (Unauthorized) ou 403 (Forbidden) indica credencial/token inválido ou revogado
            if (status === 401 || status === 403) {
              console.warn('Sessão expirada ou não autorizada (401/403). Limpando autenticação.')
              pb.authStore.clear()
              return
            }
            // Outros erros (0, timeout, 502, 503, 504, erro de rede): manter sessão!
            console.warn(
              `Instabilidade na verificação da sessão (tentativa ${attempt + 1}/${retries + 1}):`,
              err,
            )
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, delayMs))
            }
          }
        }
        // Se todas as tentativas falharem por lentidão/rede, mantemos a sessão do authStore ativa
        console.warn('Servidor temporariamente indisponível. Mantendo sessão local persistida.')
      }

      refreshWithRetry().finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
    return () => {
      unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      await pb.collection('users').create({ email, password, passwordConfirm: password })
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
