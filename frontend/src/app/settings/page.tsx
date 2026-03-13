'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, RefreshCw, Save, Plus, X, CheckCircle, AlertTriangle, ExternalLink, Mail, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface AppSettings {
  check_delay_seconds: number
  max_iterations: number
  test_accounts: string[]
  smtp_from_name: string
}

interface OAuthAccount {
  email: string
  status: 'active' | 'expired' | 'error'
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<AppSettings>({
    check_delay_seconds: 90,
    max_iterations: 10,
    test_accounts: [],
    smtp_from_name: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Gmail OAuth accounts
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([])
  const [oauthLoading, setOauthLoading] = useState(false)
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)
  const [oauthSuccess, setOauthSuccess] = useState<string | null>(null)

  // New test account input (for the accounts to check list)
  const [newAccount, setNewAccount] = useState('')
  const [accountError, setAccountError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to load settings')
      const data: AppSettings = await res.json()
      setSettings(data)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  const fetchOAuthAccounts = useCallback(async () => {
    setOauthLoading(true)
    try {
      const res = await fetch('/api/oauth/accounts')
      if (res.ok) {
        const data = await res.json()
        setOauthAccounts(data.accounts || [])
      }
    } catch {}
    setOauthLoading(false)
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchOAuthAccounts()
  }, [fetchSettings, fetchOAuthAccounts])

  // Handle OAuth callback redirect
  useEffect(() => {
    const oauthEmail = searchParams.get('email')
    const oauthResult = searchParams.get('oauth')
    if (oauthResult === 'success' && oauthEmail) {
      setOauthSuccess(`${oauthEmail} authorized successfully!`)
      fetchOAuthAccounts()
      // Also add to test accounts if not already there
      setSettings((s) => {
        if (!s.test_accounts.includes(oauthEmail)) {
          return { ...s, test_accounts: [...s.test_accounts, oauthEmail] }
        }
        return s
      })
      setTimeout(() => setOauthSuccess(null), 5000)
      // Clean URL
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams, fetchOAuthAccounts])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_delay_seconds: settings.check_delay_seconds,
          max_iterations: settings.max_iterations,
          test_accounts: settings.test_accounts,
          smtp_from_name: settings.smtp_from_name,
        }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  const addTestAccount = () => {
    const trimmed = newAccount.trim()
    if (!trimmed) return
    if (!trimmed.includes('@')) {
      setAccountError('Please enter a valid email address.')
      return
    }
    if (settings.test_accounts.includes(trimmed)) {
      setAccountError('Account already in list.')
      return
    }
    setSettings((s) => ({ ...s, test_accounts: [...s.test_accounts, trimmed] }))
    setNewAccount('')
    setAccountError(null)
  }

  const removeTestAccount = (account: string) => {
    setSettings((s) => ({ ...s, test_accounts: s.test_accounts.filter((a) => a !== account) }))
  }

  const authorizeAccount = async () => {
    const email = newAccountEmail.trim()
    if (!email || !email.includes('@')) return
    setAddingAccount(true)
    try {
      const res = await fetch('/api/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed to start OAuth')
      const { auth_url } = await res.json()
      // Open Google's consent screen in same tab so the redirect works
      window.location.href = auth_url
    } catch (e: any) {
      setError(e.message)
      setAddingAccount(false)
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
  const labelClass = "block text-sm text-gray-400 mb-1.5"

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p>Loading settings...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="font-bold text-white text-xl">Settings</h1>
            <p className="text-gray-400 text-sm">Configure optimization behavior</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-green-300 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" /> Settings saved successfully!
          </div>
        )}
        {oauthSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-green-300 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 shrink-0" /> {oauthSuccess}
          </div>
        )}

        {/* Gmail Accounts (OAuth) */}
        <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-700/60">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" /> Gmail Accounts
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Authorize Gmail accounts so the app can check if emails land in inbox or promotions.
            </p>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Authorized accounts list */}
            {oauthLoading ? (
              <p className="text-sm text-gray-500">Loading accounts...</p>
            ) : oauthAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No Gmail accounts authorized yet.</p>
            ) : (
              <div className="space-y-2">
                {oauthAccounts.map((acc) => (
                  <div key={acc.email} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                    <span className="text-sm text-gray-200 font-mono">{acc.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      acc.status === 'active'
                        ? 'bg-green-900/50 text-green-400 border border-green-700'
                        : 'bg-red-900/50 text-red-400 border border-red-700'
                    }`}>
                      {acc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add new account */}
            <div className="pt-2 border-t border-gray-700/60 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Authorize a new Gmail account</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && authorizeAccount()}
                  placeholder="account@gmail.com"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                <button
                  onClick={authorizeAccount}
                  disabled={addingAccount || !newAccountEmail.trim()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {addingAccount ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  {addingAccount ? 'Opening...' : 'Authorize with Google'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Opens Google's sign-in page. Log in with the Gmail you want to add — the app only gets read access to check email labels.
              </p>
            </div>
          </div>
        </div>

        {/* Settings form */}
        <div className="bg-gray-900 rounded-2xl border border-gray-700 divide-y divide-gray-700/60">

          {/* Sender */}
          <div className="px-6 py-5 space-y-4">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Sender</h2>
            <div>
              <label className={labelClass}>From Name</label>
              <input
                type="text"
                value={settings.smtp_from_name}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_from_name: e.target.value }))}
                placeholder="e.g. Hari Prasad"
                className={inputClass}
              />
            </div>
          </div>

          {/* Optimization */}
          <div className="px-6 py-5 space-y-4">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Optimization</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Check Delay (seconds)</label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={settings.check_delay_seconds}
                  onChange={(e) => setSettings((s) => ({ ...s, check_delay_seconds: parseInt(e.target.value) || 90 }))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1.5">Wait time after sending before checking Gmail.</p>
              </div>
              <div>
                <label className={labelClass}>Max Iterations</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.max_iterations}
                  onChange={(e) => setSettings((s) => ({ ...s, max_iterations: parseInt(e.target.value) || 10 }))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1.5">Maximum rewrite attempts per run.</p>
              </div>
            </div>
          </div>

          {/* Test accounts (which accounts to check) */}
          <div className="px-6 py-5 space-y-4">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Accounts to Check</h2>
            <p className="text-xs text-gray-500">Which authorized Gmail accounts to actually use for each test run. Must be authorized above first.</p>

            <div className="space-y-2">
              {settings.test_accounts.length === 0 && (
                <p className="text-sm text-gray-500 italic">No accounts selected.</p>
              )}
              {settings.test_accounts.map((account) => (
                <div key={account} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                  <span className="text-sm text-gray-200 font-mono">{account}</span>
                  <button onClick={() => removeTestAccount(account)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                value={newAccount}
                onChange={(e) => { setNewAccount(e.target.value); setAccountError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && addTestAccount()}
                placeholder="account@gmail.com"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={addTestAccount}
                className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {accountError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {accountError}
              </p>
            )}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-400">
          <p className="font-medium text-gray-300 mb-1">Note</p>
          <p>SMTP credentials and the Anthropic API key must be set in the <span className="font-mono text-gray-200">.env</span> file. They cannot be changed from the UI for security reasons.</p>
        </div>
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <SettingsContent />
    </Suspense>
  )
}
