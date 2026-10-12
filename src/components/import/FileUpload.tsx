import { useRef, useState, useCallback } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  onFile: (file: File) => void
  onFiles?: (files: File[]) => void
  fileName?: string
  fileCount?: number
}

export function FileUpload({ onFile, onFiles, fileName, fileCount }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 1 && onFiles) {
        onFiles(droppedFiles)
      } else if (droppedFiles.length > 0) {
        onFile(droppedFiles[0])
      }
    },
    [onFile, onFiles],
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
        multiple
        accept=".csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const selectedFiles = e.target.files ? Array.from(e.target.files) : []
          if (selectedFiles.length > 1 && onFiles) {
            onFiles(selectedFiles)
          } else if (selectedFiles.length > 0) {
            onFile(selectedFiles[0])
          }
        }}
      />
      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <FileText className="w-10 h-10 text-primary" />
          <p className="font-medium text-slate-700">
            {fileName} {fileCount && fileCount > 1 ? `(${fileCount} partes unificadas)` : ''}
          </p>
          <Button variant="ghost" size="sm" className="text-xs">
            Trocar arquivo(s)
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="w-10 h-10 text-slate-400" />
          <p className="font-medium text-slate-600">
            Arraste um ou mais arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: <strong>.csv</strong>, <strong>.txt</strong> (delimitado por vírgula
            ou ponto-e-vírgula). Suporta seleção múltipla de partes (ex: partes 1–8000, 8001–16000,
            16001–21296).
          </p>
        </div>
      )}
    </div>
  )
}
