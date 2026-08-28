import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'PHP', label: 'PHP — Philippine Peso' },
]

const PAYMENT_METHODS = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto', label: 'Crypto (USDT / BTC / ETH)' },
  { value: 'wise', label: 'Wise' },
]

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <h2 className="font-semibold text-text">{title}</h2>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-gold/50 focus:outline-none'

export function Settings() {
  const { creator, refreshCreator } = useAuth()
  const [currency, setCurrency] = useState(creator?.payout_currency ?? 'USD')
  const [paymentMethod, setPaymentMethod] = useState(creator?.payment_method ?? '')
  const [paymentDetails, setPaymentDetails] = useState(creator?.payment_details ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    const { error: updateError } = await supabase
      .from('creators')
      .update({ payout_currency: currency, payment_method: paymentMethod, payment_details: paymentDetails.trim() })
      .eq('id', creator.id)
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    await refreshCreator()
    setSaved(true)
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === paymentMethod)
  const detailsPlaceholder = {
    paypal: 'your@email.com',
    crypto: 'Wallet address (USDT TRC-20, BTC, or ETH)',
    wise: 'your@email.com',
  }[paymentMethod] ?? 'Account details'

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">Manage your account preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Payment method */}
        <Section title="Payment Method">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className={inputCls}
              >
                <option value="">Select a payment method…</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {paymentMethod && (
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  {selectedMethod?.label} details
                </label>
                <input
                  value={paymentDetails}
                  onChange={e => setPaymentDetails(e.target.value)}
                  placeholder={detailsPlaceholder}
                  className={inputCls}
                />
              </div>
            )}
            <p className="text-xs text-text-muted/60">Your payment info is private — only admins can see it when processing your payout.</p>
          </div>
        </Section>

        {/* Display currency */}
        <Section title="Display Currency">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Show earnings in</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className={inputCls}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-text-muted/60">Payouts are sent in USD — this only changes how amounts display on your dashboard.</p>
          </div>
        </Section>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-gold">✓ Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
