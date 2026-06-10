import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

// Bump this number whenever you ship a build that users MUST update to.
// Current minimum: build 13 (v1.1) — contains critical security fixes.
const MIN_BUILD = 13
const APP_STORE_URL = 'https://apps.apple.com/app/id6744042195'

export default function UpdatePrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapApp.getInfo().then(info => {
      const build = parseInt(info.build, 10)
      if (!isNaN(build) && build < MIN_BUILD) setShow(true)
    }).catch(() => {})
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1A6B5C] flex items-center justify-center text-2xl">
            🔒
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
              Security Update Available
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Version 1.1</p>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 text-sm mb-5 leading-relaxed">
          This update includes important security improvements to protect your account. We strongly recommend updating now.
        </p>

        <div className="flex flex-col gap-2">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 rounded-xl bg-[#1A6B5C] text-white font-semibold text-center text-sm"
          >
            Update on the App Store
          </a>
          <button
            onClick={() => setShow(false)}
            className="w-full py-3 rounded-xl text-gray-500 dark:text-gray-400 font-medium text-sm"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
