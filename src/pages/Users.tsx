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
import { UserCog, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const { toast } = useToast()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  const initialFormData = {
    name: '',
    email: '',
    password: '',
    role: 'attendant' as const,
  }

  const [formData, setFormData] = useState(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const openCreate = () => {
    setFormData(initialFormData)
    setErrors({})
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    try {
      const data = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.password,
        role: formData.role,
      }
      await pb.collection('users').create(data)
      setIsCreateOpen(false)
      setFormData(initialFormData)
      toast({ title: 'Usuário criado com sucesso' })
      loadUsers()
    } catch (err: any) {
      const fieldErrors = extractFieldErrors(err)
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' })
      }
    }
  }

  const openEdit = (u: User) => {
    setUserToEdit(u)
    setFormData({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'attendant',
    })
    setErrors({})
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    try {
      const data: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      }
      if (formData.password) {
        data.password = formData.password
        data.passwordConfirm = formData.password
      }
      await pb.collection('users').update(userToEdit!.id, data)
      setIsEditOpen(false)
      setUserToEdit(null)
      setFormData(initialFormData)
      toast({ title: 'Usuário atualizado com sucesso' })
      loadUsers()
    } catch (err: any) {
      const fieldErrors = extractFieldErrors(err)
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
      }
    }
  }

  const confirmDelete = async () => {
    if (!userToDelete) return
    try {
      await pb.collection('users').delete(userToDelete.id)
      setUserToDelete(null)
      toast({ title: 'Usuário removido com sucesso' })
      loadUsers()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <UserCog className="w-8 h-8 text-primary" /> Equipe & Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os acessos e permissões da equipe clínica.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar Usuário
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-900">{u.name || '-'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(u)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setUserToDelete(u)}
                            className="text-red-600 focus:text-red-600"
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nome</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Senha</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Papel</Label>
              <Select
                value={formData.role}
                onValueChange={(val: any) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="veterinarian">Veterinário</SelectItem>
                  <SelectItem value="attendant">Atendente</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
            </div>
            <DialogFooter>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={8}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Papel</Label>
              <Select
                value={formData.role}
                onValueChange={(val: any) => setFormData({ ...formData, role: val })}
                disabled={userToEdit?.id === user?.id} // prevent self demotion
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="veterinarian">Veterinário</SelectItem>
                  <SelectItem value="attendant">Atendente</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
            </div>
            <DialogFooter>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja remover este usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso removerá permanentemente o acesso do usuário
              <strong> {userToDelete?.name || userToDelete?.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
