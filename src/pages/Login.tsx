import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const { signIn } = useAuth()
  const { clinicName, clinicLogoUrl } = useClinicSettings()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast({
        title: 'Erro de Autenticação',
        description: 'Credenciais inválidas. Verifique seu email e senha.',
        variant: 'destructive',
      })
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="space-y-2 text-center pb-6">
          {clinicLogoUrl ? (
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2 overflow-hidden shadow-2xs p-1">
              <img src={clinicLogoUrl} alt={clinicName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-2">
              <span className="text-white font-bold text-2xl">
                {clinicName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <CardTitle className="text-2xl font-bold tracking-tight">{clinicName}</CardTitle>
          <CardDescription>Acesse o sistema de gestão veterinária</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
