import { Patient } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ReturnsTab({ patient }: { patient: Patient }) {
  return (
    <Card className="border-none shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 pb-4">
        <CardTitle className="text-lg text-slate-800">Agenda de Retornos e Vacinas</CardTitle>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Novo Retorno
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white">
              <TableHead className="w-[150px]">Data Prevista</TableHead>
              <TableHead>Atividade / Vacina</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[80px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patient.returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhum retorno agendado.
                </TableCell>
              </TableRow>
            ) : (
              patient.returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-medium">
                    {ret.date ? new Date(ret.date).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">{ret.activity}</TableCell>
                  <TableCell className="text-sm text-slate-500">{ret.notes || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={ret.status === 'Pendente' ? 'default' : 'secondary'}
                      className={
                        ret.status === 'Pendente'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          : ret.status === 'Nota'
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                            : 'bg-green-100 text-green-800 hover:bg-green-100'
                      }
                    >
                      {ret.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
