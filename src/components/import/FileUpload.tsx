import { useRef, useState, useCallback } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  onFile: (file: File) => void
  fileName?: string
}

export function FileUpload({ onFile, fileName }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
        dragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <FileText className="w-10 h-10 text-primary" />
          <p className="font-medium text-slate-700">{fileName}</p>
          <Button variant="ghost" size="sm" className="text-xs">
            Trocar arquivo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="w-10 h-10 text-slate-400" />
          <p className="font-medium text-slate-600">
            Arraste um arquivo aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: <strong>.csv</strong>, <strong>.txt</strong> (delimitado por vírgula
            ou ponto-e-vírgula)
          </p>
        </div>
      )}
    </div>
  )
}
