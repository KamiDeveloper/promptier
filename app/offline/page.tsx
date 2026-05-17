import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-16">
      <Card className="max-w-md space-y-16">
        <MascotAnimation variant="greeting" size="lg" crop="tight" />
        <h1 className="text-[20px] font-bold uppercase tracking-widest">Sin conexion</h1>
        <p className="text-[13px] text-dim-gray">
          Puedes seguir usando el vault local. Las funciones de AI, sync y publicacion se reanudan al volver online.
        </p>
        <Link href="/vault">
          <Button variant="primary" size="sm">Volver al vault</Button>
        </Link>
      </Card>
    </main>
  )
}
