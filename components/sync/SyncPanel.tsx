'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/authClient'
import { useNetwork } from '@/lib/hooks/useNetwork'
import { syncVault, countPending } from '@/lib/services/syncService'
import type { SyncResult } from '@/lib/services/syncService'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

export function SyncPanel() {
  const { data: session } = authClient.useSession()
  const { online } = useNetwork()
  const feedback = useMotionFeedback()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    countPending().then(setPendingCount).catch(() => setPendingCount(null))
  }, [])

  if (!session?.user) return null

  const handleSync = async () => {
    if (!online) {
      feedback.notify({ title: 'Sin conexion', message: 'La sincronizacion necesita red.', tone: 'warning' })
      return
    }
    setSyncing(true)
    setResult(null)
    try {
      const res = await syncVault()
      setResult(res)
      const count = await countPending()
      setPendingCount(count)
      feedback.notify({
        title: res.errors.length > 0 ? 'Sync con errores' : 'Sync completada',
        message: `${res.pushed + res.imagesPushed} enviadas / ${res.pulled + res.imagesPulled} recibidas / ${res.imagesPushed + res.imagesPulled} imagenes / ${res.conflicts} conflictos`,
        tone: res.errors.length > 0 ? 'warning' : 'success',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="surface-card motion-panel space-y-3 rounded-(--radius-card) border border-muted-ash p-4">
      <div className="flex items-center justify-between gap-8">
        <span className="font-terminal text-[13px] uppercase tracking-widest text-ghost-white">
          Sincronizar Vault
        </span>
        {pendingCount !== null && pendingCount > 0 && (
          <Badge variant="pending"><span className="tabular-nums">{pendingCount}</span> pendiente{pendingCount !== 1 ? 's' : ''}</Badge>
        )}
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleSync}
        loading={syncing}
        disabled={!online || syncing}
        className="w-full"
      >
        {online ? 'Sincronizar ahora' : 'Sin conexion'}
      </Button>

      {syncing && (
        <div className="flex items-center gap-8 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-8 text-[12px] text-dim-gray" role="status">
          <MascotAnimation variant="loading" size="xs" crop="tight" />
          Sincronizando cambios locales...
        </div>
      )}

      {result && (
        <div className="motion-panel space-y-1 font-terminal text-xs">
          {result.pushed > 0 && (
            <p className="text-ghost-white">
              subida: <span className="tabular-nums">{result.pushed}</span>
            </p>
          )}
          {result.imagesPushed > 0 && (
            <p className="text-ghost-white">
              imagenes subidas: <span className="tabular-nums">{result.imagesPushed}</span>
            </p>
          )}
          {result.pulled > 0 && (
            <p className="text-ghost-white">
              bajada: <span className="tabular-nums">{result.pulled}</span>
            </p>
          )}
          {result.imagesPulled > 0 && (
            <p className="text-ghost-white">
              imagenes bajadas: <span className="tabular-nums">{result.imagesPulled}</span>
            </p>
          )}
          {result.imagesDeleted > 0 && (
            <p className="text-dim-gray">
              imagenes borradas: <span className="tabular-nums">{result.imagesDeleted}</span>
            </p>
          )}
          {result.conflicts > 0 && (
            <p className="text-dim-gray">
              conflictos: <span className="tabular-nums">{result.conflicts}</span>
            </p>
          )}
          {result.errors.length > 0 && (
            <p className="text-dim-gray">
              errores: <span className="tabular-nums">{result.errors.length}</span> {result.errors[0]}
            </p>
          )}
          {result.pushed === 0 && result.pulled === 0 && result.imagesPushed === 0 && result.imagesPulled === 0 && result.imagesDeleted === 0 && result.errors.length === 0 && (
            <p className="text-dim-gray">Todo al dia</p>
          )}
        </div>
      )}
    </div>
  )
}
