import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, SlidersHorizontal, ChevronRight } from 'lucide-react'
import { mockPatients } from '@/lib/mock-data'

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPatients = mockPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.includes(searchTerm),
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pacientes & Tutores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os cadastros de animais e seus responsáveis.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Novo Cadastro
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center justify-between bg-white rounded-t-lg">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, tutor ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 w-full"
              />
            </div>
            <Button variant="outline" className="w-full sm:w-auto gap-2 text-slate-600">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Espécie/Raça</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Última Visita</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhum paciente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient) => (
                    <TableRow
                      key={patient.id}
                      className="group hover:bg-slate-50 cursor-pointer transition-colors"
                      asChild
                    >
                      <Link to={`/pacientes/${patient.id}`} className="contents">
                        <TableCell className="font-mono text-sm text-slate-500">
                          {patient.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                            {patient.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Badge
                              variant="secondary"
                              className={
                                patient.species === 'Cão'
                                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-50'
                                  : 'bg-purple-50 text-purple-700 hover:bg-purple-50'
                              }
                            >
                              {patient.species}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{patient.breed}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {patient.owner.name}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(patient.lastVisit).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </Button>
                        </TableCell>
                      </Link>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
