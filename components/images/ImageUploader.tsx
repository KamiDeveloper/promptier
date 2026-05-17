'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Clipboard, Upload } from 'lucide-react'

type Props = {
  onFiles: (files: File[]) => Promise<void> | void
  disabled?: boolean
}

export function ImageUploader({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pasteTargetRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pasteHint, setPasteHint] = useState('')

  async function handleFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) {
      setPasteHint('No se encontraron imagenes en el portapapeles.')
      return
    }
    setBusy(true)
    try {
      await onFiles(images)
      setPasteHint(`${images.length} imagen${images.length === 1 ? '' : 'es'} agregada${images.length === 1 ? '' : 's'}.`)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handlePasteButton() {
    if (disabled || busy) return
    setPasteHint('')

    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read()
        const files: File[] = []

        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith('image/'))
          if (!imageType) continue
          const blob = await item.getType(imageType)
          const extension = imageType.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
          files.push(new File([blob], `clipboard-image-${Date.now()}.${extension}`, { type: imageType }))
        }

        if (files.length > 0) {
          await handleFiles(files)
          return
        }
      }

      setPasteHint('Portapapeles listo: pega aqui con Ctrl+V, Cmd+V o el menu Pegar del sistema.')
      pasteTargetRef.current?.focus()
    } catch {
      setPasteHint('Permiso de portapapeles no concedido. Toca esta zona y usa Pegar del sistema.')
      pasteTargetRef.current?.focus()
    }
  }

  return (
    <div
      ref={pasteTargetRef}
      tabIndex={0}
      className={[
        'motion-card min-w-0 rounded-(--radius-card) border border-dashed p-12 outline-none focus-visible:ring-1 focus-visible:ring-ghost-white sm:p-16',
        dragging ? 'border-ghost-white bg-muted-ash' : 'border-muted-ash bg-steel-gray',
        busy ? 'motion-busy' : '',
      ].join(' ')}
      onPaste={(event) => {
        const files = event.clipboardData.files
        if (files.length > 0) {
          event.preventDefault()
          void handleFiles(files)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void handleFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || busy}
        onChange={(event) => {
          if (event.target.files) void handleFiles(event.target.files)
        }}
      />
      <div className="flex min-w-0 flex-col gap-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="wrap-break-word text-[12px] text-ghost-white uppercase tracking-widest sm:text-[13px]">
            Imagenes de referencia
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-dim-gray sm:text-[12px]">
            Original local + copia optimizada 720p WebP/JPEG.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:flex sm:shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={handlePasteButton}
            className="px-10 sm:px-16"
          >
            <Clipboard size={15} aria-hidden="true" />
            Pegar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            loading={busy}
            onClick={() => inputRef.current?.click()}
            className="px-10 sm:px-16"
          >
            <Upload size={15} aria-hidden="true" />
            Adjuntar
          </Button>
        </div>
      </div>
      {pasteHint && (
        <p className="mt-10 text-[11px] leading-relaxed text-dim-gray" aria-live="polite">
          {pasteHint}
        </p>
      )}
    </div>
  )
}
