import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { UserCog } from 'lucide-react'

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const { toast } = useToast()

  const loadUsers = async () => {
    try {
      const records = await pb.collection('users').getFullList<User>({ sort: '-created' })
      setUsers(records)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers()
    }
  }, [user])
  useRealtime('users', () => loadUsers(), user?.role === 'admin')

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await pb.collection('users').update(userId, { role: newRole })
      toast({ title: 'Papel atualizado com sucesso' })
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
      loadUsers() // revert
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center mt-12">
        <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">
          Apenas administradores podem acessar esta página.
        </p>
      </div>
    )
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Admin</Badge>
        )
      case 'veterinarian':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
            Veterinário
          </Badge>
        )
      case 'attendant':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
            Atendente
          </Badge>
        )
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <UserCog className="w-8 h-8 text-primary" /> Equipe & Usuários
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os acessos e permissões da equipe clínica.
        </p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel Atual</TableHead>
                  <TableHead>Alterar Permissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-900">{u.name || '-'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role || 'attendant'}
                        onValueChange={(val) => handleRoleChange(u.id, val)}
                        disabled={u.id === user?.id} // prevent self demotion
                      >
                        <SelectTrigger className="w-[180px] bg-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="veterinarian">Veterinário</SelectItem>
                          <SelectItem value="attendant">Atendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
