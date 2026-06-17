'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  // Intervalo em milissegundos entre cada atualização (padrão 60s)
  intervalMs?: number
}

// Recarrega os dados do Server Component pai chamando router.refresh()
// periodicamente, sem recarregar a página inteira.
export default function AutoRefresh({ intervalMs = 60000 }: Props) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
