import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Settings() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu perfil e as preferências da clínica.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Perfil de Usuário</CardTitle>
            <CardDescription>Informações da sua conta de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                defaultValue={user?.name || 'Administrador'}
                readOnly
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={user?.email} readOnly className="bg-slate-50" />
            </div>
            <Button variant="outline" disabled className="mt-2">
              Alterar Senha
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Dados da Clínica</CardTitle>
            <CardDescription>Configurações gerais do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Clínica</Label>
              <Input defaultValue="Clínica Veterinária Central" />
            </div>
            <div className="space-y-2">
              <Label>Telefone de Contato</Label>
              <Input defaultValue="(11) 3333-4444" />
            </div>
            <Button className="mt-2">Salvar Preferências</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
