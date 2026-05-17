'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'

export function OfflineBadge() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <Badge variant="offline" aria-live="polite" aria-label="Sin conexion a internet">
      <span aria-hidden="true">o</span> offline
    </Badge>
  )
}
