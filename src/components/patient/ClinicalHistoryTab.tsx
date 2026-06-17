import { Patient } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Activity, Weight } from 'lucide-react'

export function ClinicalHistoryTab({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-end">
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Nova Evolução Clínica
        </Button>
      </div>

      <div className="space-y-4">
        {patient.clinicalRecords.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
            Nenhum registro clínico encontrado para este paciente.
          </div>
        ) : (
          patient.clinicalRecords.map((record) => (
            <Card key={record.id} className="border-none shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-6 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-primary">
                    {new Date(record.date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                  <span className="font-medium">Peso:</span> {record.weight}
                </div>
              </div>
              <CardContent className="p-6 grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Sintomas / Queixa
                  </h4>
                  <p className="text-slate-800">{record.symptoms}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Diagnóstico
                  </h4>
                  <p className="text-slate-800 font-medium">{record.diagnosis}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Tratamento Prescrito
                  </h4>
                  <p className="text-slate-800">{record.treatment}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
