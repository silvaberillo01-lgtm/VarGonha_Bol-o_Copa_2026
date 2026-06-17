'use client'

import { useState } from 'react'
import {
  ShareSpec,
  generateShareCard,
  downloadCanvas,
  copyCanvasToClipboard,
  canShareImage,
  shareCanvas,
} from '@/lib/shareCard'

interface Props {
  spec: ShareSpec
  label?: string
  className?: string
  filename?: string
  shareText?: string
}

export default function ShareCardButton({
  spec,
  label = '📲 Compartilhar',
  className,
  filename,
  shareText,
}: Props) {
  const [open, setOpen] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [shareMsg, setShareMsg] = useState<string>('')

  const nativeShare = canShareImage()
  const finalName = filename || `vargonha-${spec.type}.png`
  const finalText = shareText || 'VARgonha — Bolão da Copa 2026 🏆'

  const handleOpen = () => {
    const c = generateShareCard(spec)
    setCanvas(c)
    setImgUrl(c.toDataURL('image/png'))
    setCopied('idle')
    setShareMsg('')
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setImgUrl(null)
    setCanvas(null)
  }

  const handleShare = async () => {
    if (!canvas) return
    const res = await shareCanvas(canvas, finalName, finalText)
    if (res === 'unsupported') {
      // Sem suporte: cai pro copiar/baixar.
      setShareMsg('Seu aparelho não abre o compartilhamento direto. Use Copiar ou Baixar.')
    } else if (res === 'error') {
      setShareMsg('Não rolou abrir o compartilhamento. Tente Baixar e anexar.')
    } else {
      setShareMsg('')
    }
  }

  const handleCopy = async () => {
    if (!canvas) return
    const ok = await copyCanvasToClipboard(canvas)
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied('idle'), 2500)
  }

  const handleDownload = () => {
    if (!canvas) return
    downloadCanvas(canvas, finalName)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={
          className ||
          'inline-flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors'
        }
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-green-800">Seu card está pronto 🎉</h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                ✕
              </button>
            </div>

            {imgUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt="Card de compartilhamento" className="w-full rounded-xl border border-gray-200" />
            )}

            {/* Botão principal: compartilhar nativo (abre WhatsApp no celular) */}
            {nativeShare && (
              <button
                onClick={handleShare}
                className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                📲 Compartilhar
              </button>
            )}

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={handleDownload}
                className="bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                ⬇️ Baixar
              </button>
              <button
                onClick={handleCopy}
                className="bg-yellow-500 hover:bg-yellow-400 text-green-900 font-semibold py-2.5 rounded-lg transition-colors"
              >
                {copied === 'ok' ? '✅ Copiado!' : copied === 'fail' ? '⬇️ Use Baixar' : '📋 Copiar'}
              </button>
            </div>

            {shareMsg && <p className="text-xs text-red-500 mt-2 text-center">{shareMsg}</p>}
            {copied === 'fail' && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Seu navegador não permite copiar imagem. Use o botão Baixar e anexe no WhatsApp.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-3 text-center">
              {nativeShare
                ? 'Toque em Compartilhar e escolha o WhatsApp 💚'
                : 'Baixe ou copie e cole na conversa do grupo 💚'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
