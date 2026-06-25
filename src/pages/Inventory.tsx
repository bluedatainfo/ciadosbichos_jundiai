import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { InventoryItem } from '@/lib/types'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, AlertTriangle, Package, Edit, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Inventory() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'
  const [items, setItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    unit: 'un',
    min_stock: 5,
  })

  const loadItems = async () => {
    try {
      const records = await pb.collection('inventory').getFullList<InventoryItem>({ sort: 'name' })
      setItems(records)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])
  useRealtime('inventory', () => loadItems())

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingItem) {
        await pb.collection('inventory').update(editingItem.id, formData)
        toast({ title: 'Item atualizado com sucesso!' })
      } else {
        await pb.collection('inventory').create(formData)
        toast({ title: 'Item criado com sucesso!' })
      }
      setIsDialogOpen(false)
      setEditingItem(null)
      setFormData({ name: '', category: '', quantity: 0, unit: 'un', min_stock: 5 })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este item?')) return
    try {
      await pb.collection('inventory').delete(id)
      toast({ title: 'Item excluído' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      min_stock: item.min_stock,
    })
    setIsDialogOpen(true)
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Estoque
          </h1>
          <p className="text-sm text-muted-foreground">Controle de insumos e medicamentos</p>
        </div>

        {isAdmin && (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(o) => {
              setIsDialogOpen(o)
              if (!o) {
                setEditingItem(null)
                setFormData({ name: '', category: '', quantity: 0, unit: 'un', min_stock: 5 })
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-white hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome do Produto/Insumo</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input
                      placeholder="ex: un, ml, cx"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estoque Mín.</Label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={formData.min_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Salvar Item
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="py-4 px-6 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar itens..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filteredItems.map((item) => {
                const isLowStock = item.quantity <= item.min_stock
                return (
                  <TableRow key={item.id} className={isLowStock ? 'bg-red-50/30' : ''}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category || '-'}</TableCell>
                    <TableCell>
                      <span className={isLowStock ? 'text-red-600 font-bold' : ''}>
                        {item.quantity} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <Badge
                          variant="destructive"
                          className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
                        >
                          <AlertTriangle className="w-3 h-3" /> Estoque Baixo
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50"
                        >
                          Adequado
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Edit className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
