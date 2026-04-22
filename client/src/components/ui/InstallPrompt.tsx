import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50
      bg-gradient-to-r from-pink-900 to-purple-900
      rounded-2xl p-4 shadow-2xl border border-pink-500/30">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" className="w-12 h-12 rounded-xl" />
        <div className="flex-1">
          <p className="text-white font-bold text-sm">
            Add Swoono to your home screen
          </p>
          <p className="text-pink-300 text-xs">
            Play anytime — even offline
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="text-gray-400 text-xs px-3 py-2
              rounded-lg hover:bg-white/10"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="bg-pink-500 text-white text-xs
              font-bold px-3 py-2 rounded-lg
              hover:bg-pink-400"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}