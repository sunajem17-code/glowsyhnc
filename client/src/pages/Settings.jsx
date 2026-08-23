import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  User, Crown, Ruler, Bell, Palette, Trash2, LogOut,
  ChevronRight, Shield, FileText, Mail, AlertTriangle,
} from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { isNative } from '../utils/iap'
import { clearAllScanMedia } from '../utils/scanPhotoDb'
import { triggerHaptic } from '../utils/haptics'
import { requestNotificationPermission } from '../utils/notifications'
import { GOLD } from '../utils/theme'

// ── Small primitives ──────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <p className="font-heading font-bold text-[11px] tracking-[0.16em] px-1 mb-2 mt-6 first:mt-0"
       style={{ color: GOLD }}>
      {title}
    </p>
  )
}

function SettingsRow({ icon: Icon, label, value, onPress, danger, disabled, rightElement }) {
  const content = (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-opacity"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: danger ? 'rgba(224,122,95,0.12)' : 'rgba(198,168,92,0.1)' }}
      >
        <Icon size={17} style={{ color: danger ? '#E07A5F' : GOLD }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[14px] font-medium text-primary leading-snug"
           style={{ color: danger ? '#E07A5F' : undefined }}>
          {label}
        </p>
        {value && (
          <p className="font-body text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {value}
          </p>
        )}
      </div>
      {rightElement ?? (onPress && !disabled
        ? <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        : null)}
    </div>
  )

  if (!onPress || disabled) return content
  return (
    <button className="w-full text-left active:scale-[0.98] transition-transform" onClick={() => { triggerHaptic(); onPress() }}>
      {content}
    </button>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => { triggerHaptic(); onChange(!value) }}
      className="relative flex-shrink-0 transition-all"
      style={{
        width: 44, height: 26,
        borderRadius: 13,
        background: value ? GOLD : 'rgba(255,255,255,0.15)',
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3, left: value ? 21 : 3,
          width: 20, height: 20,
          borderRadius: 10,
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate()

  const {
    user, isGuest, isPremium, logout,
    theme, toggleTheme,
    units, setUnits,
    clearAllScanData,
  } = useStore()

  const [appVersion, setAppVersion] = useState('')
  const [notifPermission, setNotifPermission] = useState(null) // 'granted' | 'denied' | 'prompt' | null
  const [notifRequesting, setNotifRequesting] = useState(false)

  // Delete-account flow
  const [deleteStep, setDeleteStep] = useState('idle') // 'idle' | 'confirm' | 'loading' | 'error'
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Clear scan history flow
  const [clearConfirm, setClearConfirm] = useState(false)

  // Sign-out confirmation
  const [signOutConfirm, setSignOutConfirm] = useState(false)

  useEffect(() => {
    if (!isNative()) { setAppVersion('web'); return }
    CapApp.getInfo()
      .then(info => setAppVersion(`v${info.version} (${info.build})`))
      .catch(() => setAppVersion(''))
  }, [])

  useEffect(() => {
    if (!isNative()) return
    import('@capacitor/local-notifications').then(({ LocalNotifications }) =>
      LocalNotifications.checkPermissions().then(p => setNotifPermission(p.display))
    ).catch(() => {})
  }, [])

  async function handleRequestNotifications() {
    setNotifRequesting(true)
    try {
      const granted = await requestNotificationPermission()
      setNotifPermission(granted ? 'granted' : 'denied')
    } finally {
      setNotifRequesting(false)
    }
  }

  async function handleManageSubscription() {
    if (isNative()) {
      await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' }).catch(() => {})
    } else {
      navigate('/premium')
    }
  }

  async function handleDeleteAccount() {
    setDeleteStep('loading')
    setDeleteError('')
    try {
      const result = await api.user.deleteAccount()
      if (result?.error) {
        setDeleteError(result.error)
        setDeleteStep('error')
        return
      }
      // Clear local IndexedDB photos in addition to what logout() clears from Zustand
      await clearAllScanMedia().catch(err => console.warn('[Settings] clearAllScanMedia on delete failed:', err))
      logout()
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err?.message || 'Deletion failed. Email support@ascendus.com.')
      setDeleteStep('error')
    }
  }

  function openMailto(address, subject) {
    const url = `mailto:${address}?subject=${encodeURIComponent(subject)}${appVersion ? `&body=${encodeURIComponent(`App version: ${appVersion}\n\n`)}` : ''}`
    // window.open / window.location both work in WKWebView and route to Mail.app
    // Capacitor Browser.open cannot handle mailto: schemes
    window.open(url, '_blank')
  }

  async function handleClearScans() {
    clearAllScanData()
    await clearAllScanMedia().catch(err => console.warn('[Settings] clearAllScanMedia failed:', err))
    setClearConfirm(false)
  }

  async function openLink(url) {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url }).catch(() => {})
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }

  const isDark = theme === 'dark'
  const displayName = user?.name ?? (isGuest ? 'Guest' : 'Ascendus User')
  const displayEmail = user?.email ?? (isGuest ? 'Guest session' : null)

  // ── Delete account confirmation sheet ──────────────────────────────────────
  if (deleteStep === 'confirm' || deleteStep === 'loading' || deleteStep === 'error') {
    const canDelete = deleteConfirmText.trim().toUpperCase() === 'DELETE'
    return (
      <MotionPage className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
               style={{ background: 'rgba(224,122,95,0.12)' }}>
            <AlertTriangle size={26} style={{ color: '#E07A5F' }} />
          </div>
          <h2 className="font-heading font-bold text-[22px] text-primary mb-3">Delete Account?</h2>
          <p className="font-body text-[14px] mb-2" style={{ color: 'var(--text-secondary)' }}>
            This permanently deletes your account, all scans, your Glow Score history, and any active subscription reference. This cannot be undone.
          </p>
          {isPremium && (
            <p className="font-body text-[13px] mb-4" style={{ color: '#E07A5F' }}>
              Cancel your subscription first in {isNative() ? 'iOS Settings → Subscriptions' : 'your billing portal'} to avoid further charges.
            </p>
          )}
          <p className="font-body text-[13px] mb-2 text-left w-full" style={{ color: 'var(--text-secondary)' }}>
            Type <span className="font-heading font-bold" style={{ color: '#E07A5F' }}>DELETE</span> to confirm:
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
            disabled={deleteStep === 'loading'}
            className="w-full px-4 py-3 rounded-xl font-heading font-bold text-[15px] mb-4 text-center outline-none"
            style={{
              background: 'var(--card)',
              border: `1px solid ${canDelete ? '#E07A5F' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              letterSpacing: '0.1em',
            }}
          />
          {deleteError && (
            <p className="font-body text-[13px] mb-4" style={{ color: '#E07A5F' }}>{deleteError}</p>
          )}
          <button
            onClick={handleDeleteAccount}
            disabled={!canDelete || deleteStep === 'loading'}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-3 transition-opacity"
            style={{ background: '#E07A5F', color: '#fff', opacity: (!canDelete || deleteStep === 'loading') ? 0.4 : 1 }}
          >
            {deleteStep === 'loading' ? 'Deleting…' : 'Delete My Account'}
          </button>
          <button
            onClick={() => { setDeleteStep('idle'); setDeleteError(''); setDeleteConfirmText('') }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
        </div>
      </MotionPage>
    )
  }

  // ── Sign-out confirmation ──────────────────────────────────────────────────
  if (signOutConfirm) {
    return (
      <MotionPage className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
               style={{ background: 'rgba(198,168,92,0.1)' }}>
            <LogOut size={26} style={{ color: GOLD }} />
          </div>
          <h2 className="font-heading font-bold text-[22px] text-primary mb-3">Sign Out?</h2>
          <p className="font-body text-[14px] mb-8" style={{ color: 'var(--text-secondary)' }}>
            Your scan history and settings are saved locally. You'll need to sign back in to access your account.
          </p>
          <button
            onClick={() => { logout(); navigate('/', { replace: true }) }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-3"
            style={{ background: GOLD, color: '#0A0A0A' }}
          >
            Sign Out
          </button>
          <button
            onClick={() => setSignOutConfirm(false)}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
        </div>
      </MotionPage>
    )
  }

  // ── Clear scans confirmation ────────────────────────────────────────────────
  if (clearConfirm) {
    return (
      <MotionPage className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
               style={{ background: 'rgba(198,168,92,0.1)' }}>
            <Trash2 size={26} style={{ color: GOLD }} />
          </div>
          <h2 className="font-heading font-bold text-[22px] text-primary mb-3">Clear Scan History?</h2>
          <p className="font-body text-[14px] mb-8" style={{ color: 'var(--text-secondary)' }}>
            All locally stored scans and Glow Scores will be removed from this device. This cannot be undone.
          </p>
          <button
            onClick={handleClearScans}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-3"
            style={{ background: GOLD, color: '#0A0A0A' }}
          >
            Clear History
          </button>
          <button
            onClick={() => setClearConfirm(false)}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
        </div>
      </MotionPage>
    )
  }

  // ── Main settings list ─────────────────────────────────────────────────────
  return (
    <MotionPage
      className="flex flex-col"
      style={{ background: 'var(--bg)', minHeight: '100%' }}
    >
      <div
        className="px-5 pb-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
      >
        <h1 className="font-heading font-bold text-[28px] text-primary mb-1"
            style={{ letterSpacing: '-0.02em' }}>
          Settings
        </h1>

        {/* ── Account ── */}
        <SectionHeader title="ACCOUNT" />
        <div className="flex flex-col gap-2">
          <SettingsRow
            icon={User}
            label={displayName}
            value={displayEmail}
            onPress={() => navigate('/profile')}
          />
          <SettingsRow
            icon={Crown}
            label={isPremium ? 'Ascendus Premium' : 'Free Plan'}
            value={isPremium ? 'Tap to manage or cancel' : 'Tap to upgrade'}
            onPress={handleManageSubscription}
            rightElement={
              isPremium
                ? <span className="font-heading font-bold text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(198,168,92,0.15)', color: GOLD }}>✦ PREMIUM</span>
                : <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            }
          />
        </div>

        {/* ── Preferences ── */}
        <SectionHeader title="PREFERENCES" />
        <div className="flex flex-col gap-2">
          <SettingsRow
            icon={Palette}
            label="Dark Mode"
            value={isDark ? 'On' : 'Off'}
            rightElement={<Toggle value={isDark} onChange={() => toggleTheme()} />}
          />
          <SettingsRow
            icon={Ruler}
            label="Units"
            value={units === 'metric' ? 'Metric (cm)' : 'Imperial (in)'}
            rightElement={
              <div className="flex rounded-lg overflow-hidden flex-shrink-0"
                   style={{ border: '1px solid var(--border)' }}>
                {['metric', 'imperial'].map(u => (
                  <button
                    key={u}
                    onClick={() => { triggerHaptic(); setUnits(u) }}
                    className="px-3 py-1.5 font-body font-medium text-[12px] transition-colors"
                    style={{
                      background: units === u ? GOLD : 'transparent',
                      color: units === u ? '#0A0A0A' : 'var(--text-secondary)',
                    }}
                  >
                    {u === 'metric' ? 'cm' : 'in'}
                  </button>
                ))}
              </div>
            }
          />
          {isNative() && (
            <SettingsRow
              icon={Bell}
              label="Notifications"
              value={
                notifPermission === 'granted' ? 'Enabled — streak & scan reminders' :
                notifPermission === 'denied'  ? 'Blocked — enable in iOS Settings' :
                notifPermission === 'prompt'  ? 'Tap to enable reminders' :
                'Checking…'
              }
              onPress={notifPermission === 'prompt' && !notifRequesting ? handleRequestNotifications : undefined}
              disabled={notifRequesting || notifPermission === 'denied' || notifPermission === 'granted'}
            />
          )}
        </div>

        {/* ── Data & Privacy ── */}
        <SectionHeader title="DATA & PRIVACY" />
        <div className="flex flex-col gap-2">
          <SettingsRow
            icon={Trash2}
            label="Clear Scan History"
            value="Remove all scans from this device"
            onPress={() => setClearConfirm(true)}
          />
          <SettingsRow
            icon={Shield}
            label="Privacy Policy"
            onPress={() => navigate('/privacy')}
          />
        </div>

        {/* ── Sign out / danger ── */}
        <SectionHeader title="ACCOUNT ACTIONS" />
        <div className="flex flex-col gap-2">
          <SettingsRow
            icon={LogOut}
            label="Sign Out"
            onPress={() => setSignOutConfirm(true)}
          />
          {!isGuest && (
            <SettingsRow
              icon={Trash2}
              label="Delete Account"
              value="Permanently deletes your account and all data"
              onPress={() => setDeleteStep('confirm')}
              danger
            />
          )}
        </div>

        {/* ── Footer links ── */}
        <SectionHeader title="MORE" />
        <div className="flex flex-col gap-2">
          <SettingsRow
            icon={FileText}
            label="Terms of Service"
            onPress={() => navigate('/terms')}
          />
          <SettingsRow
            icon={Mail}
            label="Contact Support"
            value="support@ascendus.com"
            onPress={() => openMailto('support@ascendus.com', 'Support Request')}
          />
        </div>

        {/* App version */}
        {appVersion && (
          <p className="text-center font-body text-[11px] mt-8 opacity-40"
             style={{ color: 'var(--text-secondary)' }}>
            Ascendus {appVersion}
          </p>
        )}
      </div>
    </MotionPage>
  )
}
