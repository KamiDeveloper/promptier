import type { Metadata } from 'next'
import { getSafeRedirectPath } from '@/lib/auth/redirect'
import { GetStartedClient } from './GetStartedClient'

export const metadata: Metadata = {
  title: 'Get started',
}

type GetStartedPageProps = {
  searchParams?: Promise<{
    next?: string | string[]
  }>
}

export default async function GetStartedPage({ searchParams }: GetStartedPageProps) {
  const params = await searchParams
  const rawNext = Array.isArray(params?.next) ? params?.next[0] : params?.next
  const nextPath = getSafeRedirectPath(rawNext)

  return <GetStartedClient nextPath={nextPath} />
}
