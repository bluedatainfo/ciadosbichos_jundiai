import { Patient } from '@/lib/mock-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Image as ImageIcon } from 'lucide-react'

export function ImagesTab({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-800">Imagens Clínicas e Exames</h3>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Anexar Imagem
        </Button>
      </div>

      {patient.images.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center h-64 text-slate-500">
            <ImageIcon className="w-12 h-12 mb-4 text-slate-300" />
            <p>Nenhuma imagem anexada a esta ficha.</p>
            <p className="text-sm">
              Clique em "Anexar Imagem" para fazer upload de exames ou fotos clínicas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {patient.images.map((imgUrl, idx) => (
            <Card
              key={idx}
              className="overflow-hidden border-none shadow-sm group cursor-pointer relative"
            >
              <div className="aspect-square bg-slate-100 relative">
                <img
                  src={imgUrl}
                  alt={`Clinical image ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
