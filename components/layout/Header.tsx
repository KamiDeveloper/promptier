'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { OfflineBadge } from './OfflineBadge'
import { UserNav } from '@/components/auth/UserNav'
import { Logo } from '@/app/assets/logo'

interface HeaderProps {
  rightSlot?: ReactNode
}

const mainLinks = [
  { href: '/vault', label: 'Vault' },
  { href: '/public-prompts', label: 'Prompterest', compactLabel: 'Public' },
  { href: '/gallery', label: 'Galeria' },
]

export function Header({ rightSlot }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  return (
    <header
      className="motion-scanline sticky top-0 z-50 border-b border-muted-ash bg-midnight-oil font-terminal"
    >
      <div className="flex items-center justify-between gap-4 px-16 py-8 md:px-16">
        <Link
          href="/vault"
          aria-label="Ir al vault de Promptier"
          className="motion-press inline-flex min-h-10 items-center text-ghost-white hover:text-dim-gray focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ghost-white"
        >
          <Logo variant="imagotype" className="hidden h-7.5 w-auto sm:block" />
          <Logo variant="isotype" className="h-7.5 w-auto sm:hidden" />
        </Link>

        <nav className="hidden items-center gap-16 md:flex" aria-label="Navegacion principal">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="motion-press text-[13px] uppercase tracking-widest text-dim-gray hover:text-ghost-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-8 md:flex">
          <OfflineBadge />
          <UserNav />
          {rightSlot}
        </div>

        <div className="flex items-center gap-8 md:hidden">
          <OfflineBadge />
          {rightSlot}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Cerrar menu principal' : 'Abrir menu principal'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="motion-press inline-flex h-10 w-10 items-center justify-center rounded-(--radius-button) border border-muted-ash bg-steel-gray text-ghost-white hover:border-ghost-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ghost-white"
          >
            {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-main-menu"
        className={[
          'grid overflow-hidden border-t border-muted-ash transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden',
          mobileMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        ].join(' ')}
      >
        <div className="min-h-0">
          <nav className="grid gap-8 px-16 py-16" aria-label="Navegacion principal movil">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="motion-press flex min-h-12 items-center justify-between rounded-(--radius-button) border border-muted-ash px-16 text-[13px] uppercase tracking-widest text-ghost-white hover:border-ghost-white hover:bg-steel-gray"
              >
                <span>{link.compactLabel ?? link.label}</span>
              </Link>
            ))}
            <UserNav variant="mobile-menu" />
          </nav>
        </div>
      </div>
    </header>
  )
}
