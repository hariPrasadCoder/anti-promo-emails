'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckCircle, XCircle, Clock, Send, RefreshCw, Copy, Check,
  ChevronDown, ChevronUp, Mail, Inbox, Download, Pause, Play,
  X, AlertTriangle, Zap, LayoutTemplate,
} from 'lucide-react'
import DiffView from '../components/DiffView'
import EmailPreview from '../components/EmailPreview'
import ProgressTimeline from '../components/ProgressTimeline'
import SpamScore from '../components/SpamScore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountResult {
  account: string
  label: string
}

interface SpamCheckResult {
  score: number
  issues: string[]
  verdict: string
}

interface IterationResult {
  iteration: number
  subject: string
  body: string
  account_results: AccountResult[]
  verdict: string
  changes_made: string | null
  spam_score: SpamCheckResult | null
}

interface RunStatus {
  run_id: string
  status: string
  iterations: IterationResult[]
  final_subject: string | null
  final_body: string | null
  total_iterations: number
}

interface Template {
  id: number
  name: string
  subject: string
  body: string
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'inbox') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-300 border border-green-700">
        <CheckCircle className="w-4 h-4" /> Inbox
      </span>
    )
  }
  if (verdict === 'promotions') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-900/50 text-red-300 border border-red-700">
        <XCircle className="w-4 h-4" /> Promotions
      </span>
    )
  }
  if (verdict === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700">
        <Clock className="w-4 h-4" /> Mixed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300 border border-gray-600">
      <Clock className="w-4 h-4" /> {verdict}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Iteration Card ───────────────────────────────────────────────────────────

function IterationCard({
  iter,
  prevIter,
  isLatest,
  fromName,
}: {
  iter: IterationResult
  prevIter: IterationResult | null
  isLatest: boolean
  fromName: string
}) {
  const [expanded, setExpanded] = useState(isLatest)
  const [changesOpen, setChangesOpen] = useState(false)
  const [tab, setTab] = useState<'source' | 'preview' | 'diff'>('source')

  const showDiff = iter.iteration > 1 && prevIter !== null

  return (
    <div className={`rounded-xl border ${isLatest ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 bg-gray-900'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gray-400 text-sm font-mono shrink-0">#{iter.iteration}</span>
          <span className="font-medium text-white truncate">{iter.subject}</span>
          {isLatest && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0">Latest</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {iter.spam_score && (
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              iter.spam_score.verdict === 'good' ? 'bg-green-900/50 text-green-400' :
              iter.spam_score.verdict === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
              'bg-red-900/50 text-red-400'
            }`}>
              S:{iter.spam_score.score}
            </span>
          )}
          <VerdictBadge verdict={iter.verdict} />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
          {/* Spam score */}
          {iter.spam_score && (
            <div className="mt-4">
              <SpamScore
                score={iter.spam_score.score}
                issues={iter.spam_score.issues}
                verdict={iter.spam_score.verdict}
              />
            </div>
          )}

          {/* Account Results */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Test Accounts</p>
            <div className="flex flex-wrap gap-2">
              {iter.account_results.map((ar) => (
                <div
                  key={ar.account}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                    ar.label === 'inbox'
                      ? 'bg-green-900/30 border-green-700 text-green-300'
                      : ar.label === 'promotions'
                      ? 'bg-red-900/30 border-red-700 text-red-300'
                      : 'bg-gray-800 border-gray-600 text-gray-400'
                  }`}
                >
                  {ar.label === 'inbox' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span className="font-mono">{ar.account}</span>
                  <span className="capitalize opacity-70">· {ar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Email body tabs */}
          <div>
            <div className="flex items-center gap-1 mb-2 bg-gray-800 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setTab('source')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'source' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Source
              </button>
              <button
                onClick={() => setTab('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Preview
              </button>
              {showDiff && (
                <button
                  onClick={() => setTab('diff')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'diff' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Diff
                </button>
              )}
            </div>

            {tab === 'source' && (
              <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
                {iter.body}
              </div>
            )}
            {tab === 'preview' && (
              <EmailPreview subject={iter.subject} body={iter.body} fromName={fromName} />
            )}
            {tab === 'diff' && prevIter && (
              <DiffView
                prevSubject={prevIter.subject}
                currSubject={iter.subject}
                prevBody={prevIter.body}
                currBody={iter.body}
              />
            )}
          </div>

          {/* What Claude Changed */}
          {iter.changes_made && (
            <div>
              <button
                onClick={() => setChangesOpen(!changesOpen)}
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {changesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                What Claude changed
              </button>
              {changesOpen && (
                <div className="mt-2 bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-200">
                  {iter.changes_made}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<RunStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quickCheckMode, setQuickCheckMode] = useState(false)
  const [paused, setPaused] = useState(false)
  const [manualSubject, setManualSubject] = useState('')
  const [manualBody, setManualBody] = useState('')

  // Spam check inline
  const [spamResult, setSpamResult] = useState<SpamCheckResult | null>(null)
  const [spamLoading, setSpamLoading] = useState(false)

  // Template picker
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templatePickerLoading, setTemplatePickerLoading] = useState(false)
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false)
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Load config from backend
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.from_name) setFromName(data.from_name)
        if (data.from_email) setFromEmail(data.from_email)
      })
      .catch(() => {})
  }, [])

  // Load template from localStorage (set by Templates page "Use" button)
  useEffect(() => {
    const tSubject = localStorage.getItem('apeo_template_subject')
    const tBody = localStorage.getItem('apeo_template_body')
    if (tSubject) {
      setSubject(tSubject)
      localStorage.removeItem('apeo_template_subject')
    }
    if (tBody) {
      setBody(tBody)
      localStorage.removeItem('apeo_template_body')
    }
  }, [])

  // Scroll to bottom on new iterations
  useEffect(() => {
    if (run?.iterations.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [run?.iterations.length])

  // Update document title
  useEffect(() => {
    if (!run) {
      document.title = 'Anti-Promo Optimizer'
      return
    }
    if (run.status === 'success') {
      document.title = 'Inbox Achieved!'
    } else if (run.status === 'running') {
      document.title = `(${run.total_iterations}) Optimizing...`
    } else if (run.status === 'max_iterations') {
      document.title = `Done (${run.total_iterations} iters)`
    } else if (run.status === 'cancelled') {
      document.title = 'Cancelled'
    } else {
      document.title = 'Anti-Promo Optimizer'
    }
  }, [run?.status, run?.total_iterations])

  const checkSpam = async () => {
    if (!subject && !body) return
    setSpamLoading(true)
    try {
      const res = await fetch('/api/spam-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      if (res.ok) {
        const data = await res.json()
        setSpamResult(data)
      }
    } catch {}
    setSpamLoading(false)
  }

  const loadTemplates = async () => {
    setTemplatePickerLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {}
    setTemplatePickerLoading(false)
  }

  const openTemplatePicker = () => {
    setShowTemplatePicker(true)
    loadTemplates()
  }

  const applyTemplate = (t: Template) => {
    setSubject(t.subject)
    setBody(t.body)
    setSpamResult(null)
    setShowTemplatePicker(false)
  }

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return
    setSaveTemplateLoading(true)
    try {
      const finalSubject = run?.final_subject || subject
      const finalBody = run?.final_body || body
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, subject: finalSubject, body: finalBody }),
      })
      setSaveTemplateSuccess(true)
      setShowSaveTemplate(false)
      setTemplateName('')
      setTimeout(() => setSaveTemplateSuccess(false), 3000)
    } catch {}
    setSaveTemplateLoading(false)
  }

  const startRun = async () => {
    setError(null)
    setLoading(true)
    setRun(null)
    setPaused(false)

    try {
      const endpoint = quickCheckMode ? '/api/quick-check' : '/api/run'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_name: fromName, from_email: fromEmail, subject, body }),
      })
      if (!res.ok) throw new Error('Failed to start run')
      const data = await res.json()
      setRunId(data.run_id)
      setRun({
        run_id: data.run_id,
        status: 'running',
        iterations: [],
        final_subject: null,
        final_body: null,
        total_iterations: 0,
      })

      // Start SSE stream
      const es = new EventSource(`/api/run/${data.run_id}/stream`)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        const updated: RunStatus = JSON.parse(event.data)
        setRun(updated)

        const done = ['success', 'failed', 'max_iterations', 'cancelled', 'quick_check'].includes(updated.status)
        if (done) {
          es.close()
          setLoading(false)

          // Browser notification
          if (updated.status === 'success' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Inbox achieved!', {
              body: `Subject: ${updated.final_subject}`,
              icon: '/favicon.ico',
            })
          }
        }
      }

      es.onerror = () => {
        es.close()
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const cancelRun = async () => {
    if (!runId) return
    await fetch(`/api/run/${runId}/cancel`, { method: 'POST' })
  }

  const pauseRun = async () => {
    if (!runId) return
    await fetch(`/api/run/${runId}/pause`, { method: 'POST' })
    setPaused(true)
    // Pre-fill manual edit fields with last iteration's content
    if (run?.iterations.length) {
      const last = run.iterations[run.iterations.length - 1]
      setManualSubject(last.subject)
      setManualBody(last.body)
    }
  }

  const resumeRun = async (withEdits: boolean) => {
    if (!runId) return
    const body_payload = withEdits
      ? { manual_subject: manualSubject, manual_body: manualBody }
      : {}
    await fetch(`/api/run/${runId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body_payload),
    })
    setPaused(false)
  }

  const reset = () => {
    eventSourceRef.current?.close()
    setRun(null)
    setRunId(null)
    setLoading(false)
    setError(null)
    setPaused(false)
    document.title = 'Anti-Promo Optimizer'
  }

  const downloadResult = () => {
    if (!run?.final_subject || !run?.final_body) return
    const content = `Subject: ${run.final_subject}\n\n${run.final_body}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized-email.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isSuccess = run?.status === 'success'
  const isDone = run && ['success', 'failed', 'max_iterations', 'cancelled', 'quick_check'].includes(run.status)

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Inbox className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">New Optimization Run</h1>
            <p className="text-gray-400 text-xs">Auto-iterate until your email hits the inbox</p>
          </div>
        </div>

        {/* Template Picker Modal */}
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
              <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-white">Load Template</h3>
                <button onClick={() => setShowTemplatePicker(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {templatePickerLoading && <p className="text-gray-400 text-sm text-center py-8">Loading...</p>}
                {!templatePickerLoading && templates.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">No templates saved yet.</p>
                )}
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left p-4 rounded-xl border border-gray-700 hover:border-blue-600 bg-gray-800/50 hover:bg-blue-950/20 transition-colors"
                  >
                    <p className="font-medium text-white text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Form */}
        {!run && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                Your Marketing Email
              </h2>
              <div className="flex items-center gap-2">
                {/* Quick check toggle */}
                <button
                  onClick={() => setQuickCheckMode(!quickCheckMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    quickCheckMode
                      ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Quick Check
                </button>
                {/* Load template */}
                <button
                  onClick={openTemplatePicker}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white text-xs font-medium transition-colors"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Load Template
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">From Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">From Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@yourcompany.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSpamResult(null) }}
                placeholder="Your email subject..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setSpamResult(null) }}
                placeholder="Paste your email content here..."
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm font-mono resize-y"
              />
            </div>

            {/* Spam check button + result */}
            <div className="space-y-3">
              <button
                onClick={checkSpam}
                disabled={spamLoading || (!subject && !body)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                <AlertTriangle className="w-4 h-4" />
                {spamLoading ? 'Checking...' : 'Check Spam Score'}
              </button>
              {spamResult && (
                <SpamScore score={spamResult.score} issues={spamResult.issues} verdict={spamResult.verdict} />
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={startRun}
              disabled={!fromName || !fromEmail || !subject || !body || loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
            >
              {quickCheckMode ? <Zap className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {quickCheckMode ? 'Quick Check (no rewrite)' : 'Start Optimization'}
            </button>
          </div>
        )}

        {/* Progress Panel */}
        {run && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className={`rounded-xl border p-4 space-y-3 ${
              isSuccess ? 'bg-green-950/30 border-green-700' :
              run.status === 'max_iterations' ? 'bg-yellow-950/30 border-yellow-700' :
              run.status === 'failed' ? 'bg-red-950/30 border-red-700' :
              run.status === 'cancelled' ? 'bg-gray-800 border-gray-600' :
              'bg-blue-950/30 border-blue-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {loading && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
                  {isSuccess && <CheckCircle className="w-5 h-5 text-green-400" />}
                  <div>
                    <p className="font-medium text-white">
                      {loading && !paused ? `Running iteration ${run.total_iterations}...` :
                       loading && paused ? 'Paused — waiting for your edit' :
                       isSuccess ? 'Success! Email lands in inbox.' :
                       run.status === 'max_iterations' ? 'Max iterations reached — best version returned.' :
                       run.status === 'cancelled' ? 'Run cancelled.' :
                       run.status === 'quick_check' ? 'Quick check complete.' :
                       'Run failed.'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {run.iterations.length} iteration{run.iterations.length !== 1 ? 's' : ''} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Cancel button */}
                  {loading && (
                    <button
                      onClick={cancelRun}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                  {/* Pause/Resume */}
                  {loading && !paused && !quickCheckMode && (
                    <button
                      onClick={pauseRun}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 border border-gray-700 hover:border-yellow-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}
                  <button
                    onClick={reset}
                    className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Start over
                  </button>
                </div>
              </div>

              {/* Progress timeline */}
              {loading && (
                <ProgressTimeline
                  status={run.status}
                  totalIterations={run.total_iterations}
                  iterationsCompleted={run.iterations.length}
                />
              )}
            </div>

            {/* Manual edit panel when paused */}
            {paused && loading && (
              <div className="bg-yellow-950/20 border border-yellow-700/50 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-yellow-300 text-sm flex items-center gap-2">
                  <Pause className="w-4 h-4" /> Manual Edit Mode
                </h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Body</label>
                  <textarea
                    value={manualBody}
                    onChange={(e) => setManualBody(e.target.value)}
                    rows={8}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-yellow-500 resize-y"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => resumeRun(true)}
                    className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" /> Resume with my edits
                  </button>
                  <button
                    onClick={() => resumeRun(false)}
                    className="flex items-center gap-2 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Resume (let Claude rewrite)
                  </button>
                </div>
              </div>
            )}

            {/* Waiting indicator */}
            {loading && run.iterations.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p>Sending test emails and waiting for delivery...</p>
                <p className="text-sm text-gray-500 mt-1">This usually takes 60-90 seconds</p>
              </div>
            )}

            {/* Iterations */}
            <div className="space-y-3">
              {run.iterations.map((iter, i) => (
                <IterationCard
                  key={iter.iteration}
                  iter={iter}
                  prevIter={i > 0 ? run.iterations[i - 1] : null}
                  isLatest={i === run.iterations.length - 1}
                  fromName={fromName}
                />
              ))}
            </div>

            {/* Final Result */}
            {isDone && run.final_subject && (
              <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                  <h2 className="font-semibold text-white">
                    {isSuccess ? 'Final Email (Inbox-Ready)' : 'Best Version After All Iterations'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Save as template */}
                    {!showSaveTemplate && (
                      <button
                        onClick={() => setShowSaveTemplate(true)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" /> Save as Template
                      </button>
                    )}
                    {/* Download */}
                    <button
                      onClick={downloadResult}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>

                {/* Save as template form */}
                {showSaveTemplate && (
                  <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/30 flex items-center gap-3">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={saveAsTemplate}
                      disabled={!templateName.trim() || saveTemplateLoading}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {saveTemplateLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {saveTemplateSuccess && (
                  <div className="px-6 py-2 bg-green-900/20 border-b border-green-700/30 text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Template saved!
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Subject</p>
                      <CopyButton text={run.final_subject} />
                    </div>
                    <div className="bg-gray-800 rounded-lg px-4 py-3 text-white font-medium">
                      {run.final_subject}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Body</p>
                      <CopyButton text={run.final_body || ''} />
                    </div>
                    <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                      {run.final_body}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </main>
    </div>
  )
}
