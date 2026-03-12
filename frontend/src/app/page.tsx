'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Clock, Send, RefreshCw, Copy, Check, ChevronDown, ChevronUp, Mail, Inbox } from 'lucide-react'

interface AccountResult {
  account: string
  label: string
}

interface IterationResult {
  iteration: number
  subject: string
  body: string
  account_results: AccountResult[]
  verdict: string
  changes_made: string | null
}

interface RunStatus {
  run_id: string
  status: string
  iterations: IterationResult[]
  final_subject: string | null
  final_body: string | null
  total_iterations: number
}

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

function IterationCard({ iter, isLatest }: { iter: IterationResult; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest)
  const [changesOpen, setChangesOpen] = useState(false)

  return (
    <div className={`rounded-xl border ${isLatest ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 bg-gray-900'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-mono">#{iter.iteration}</span>
          <span className="font-medium text-white truncate max-w-md">{iter.subject}</span>
          {isLatest && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Latest</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <VerdictBadge verdict={iter.verdict} />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
          {/* Account Results */}
          <div className="mt-4">
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

          {/* Email Body Preview */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Email Body</p>
            <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
              {iter.body}
            </div>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function Home() {
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<RunStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.from_name) setFromName(data.from_name)
        if (data.from_email) setFromEmail(data.from_email)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (run?.iterations.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [run?.iterations.length])

  const startRun = async () => {
    setError(null)
    setLoading(true)
    setRun(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail,
          subject,
          body,
        }),
      })

      if (!res.ok) throw new Error('Failed to start run')
      const data = await res.json()
      setRunId(data.run_id)
      setRun({ run_id: data.run_id, status: 'running', iterations: [], final_subject: null, final_body: null, total_iterations: 0 })

      // Start SSE stream
      const es = new EventSource(`/api/run/${data.run_id}/stream`)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        const updated: RunStatus = JSON.parse(event.data)
        setRun(updated)
        if (['success', 'failed', 'max_iterations'].includes(updated.status)) {
          es.close()
          setLoading(false)
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

  const reset = () => {
    eventSourceRef.current?.close()
    setRun(null)
    setRunId(null)
    setLoading(false)
    setError(null)
  }

  const isSuccess = run?.status === 'success'
  const isDone = run && ['success', 'failed', 'max_iterations'].includes(run.status)

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Inbox className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Anti-Promo Optimizer</h1>
            <p className="text-gray-400 text-xs">Auto-iterate until your email hits the inbox</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Input Form */}
        {!run && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              Your Marketing Email
            </h2>

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
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your email subject..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste your email content here..."
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm font-mono resize-y"
              />
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
              <Send className="w-4 h-4" />
              Start Optimization
            </button>
          </div>
        )}

        {/* Progress Panel */}
        {run && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className={`rounded-xl border p-4 flex items-center justify-between ${
              isSuccess ? 'bg-green-950/30 border-green-700' :
              run.status === 'max_iterations' ? 'bg-yellow-950/30 border-yellow-700' :
              run.status === 'failed' ? 'bg-red-950/30 border-red-700' :
              'bg-blue-950/30 border-blue-700'
            }`}>
              <div className="flex items-center gap-3">
                {loading && (
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                )}
                {isSuccess && <CheckCircle className="w-5 h-5 text-green-400" />}
                <div>
                  <p className="font-medium text-white">
                    {loading ? `Running iteration ${run.total_iterations}...` :
                     isSuccess ? 'Success! Email lands in inbox.' :
                     run.status === 'max_iterations' ? 'Max iterations reached — best version returned.' :
                     'Run failed.'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {run.iterations.length} iteration{run.iterations.length !== 1 ? 's' : ''} completed
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Start over
              </button>
            </div>

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
                  isLatest={i === run.iterations.length - 1}
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
                </div>
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
