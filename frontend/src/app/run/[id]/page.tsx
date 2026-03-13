'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ArrowLeft,
  Download, Copy, Check, RefreshCw, AlertTriangle,
} from 'lucide-react'
import DiffView from '../../../components/DiffView'
import EmailPreview from '../../../components/EmailPreview'
import SpamScore from '../../../components/SpamScore'

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

interface RunDetail {
  run_id: string
  status: string
  iterations: IterationResult[]
  final_subject: string | null
  final_body: string | null
  total_iterations: number
  from_name: string | null
  from_email: string | null
  original_subject: string | null
  original_body: string | null
  created_at: string | null
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'inbox') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
      <CheckCircle className="w-3.5 h-3.5" /> Inbox
    </span>
  )
  if (verdict === 'promotions') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">
      <XCircle className="w-3.5 h-3.5" /> Promotions
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
      <Clock className="w-3.5 h-3.5" /> {verdict}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function IterationDetail({
  iter,
  prevIter,
  fromName,
}: {
  iter: IterationResult
  prevIter: IterationResult | null
  fromName: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'source' | 'preview' | 'diff'>('source')
  const showDiff = iter.iteration > 1 && prevIter !== null

  return (
    <div className={`rounded-xl border ${iter.verdict === 'inbox' ? 'border-green-700 bg-green-950/10' : 'border-gray-700 bg-gray-900'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gray-400 text-sm font-mono shrink-0">#{iter.iteration}</span>
          <span className="font-medium text-white truncate">{iter.subject}</span>
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
              <SpamScore score={iter.spam_score.score} issues={iter.spam_score.issues} verdict={iter.spam_score.verdict} />
            </div>
          )}

          {/* Account results */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Test Accounts</p>
            <div className="flex flex-wrap gap-2">
              {iter.account_results.map((ar) => (
                <div key={ar.account} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                  ar.label === 'inbox' ? 'bg-green-900/30 border-green-700 text-green-300' :
                  ar.label === 'promotions' ? 'bg-red-900/30 border-red-700 text-red-300' :
                  'bg-gray-800 border-gray-600 text-gray-400'
                }`}>
                  {ar.label === 'inbox' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span className="font-mono">{ar.account}</span>
                  <span className="capitalize opacity-70">· {ar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Body tabs */}
          <div>
            <div className="flex items-center gap-1 mb-2 bg-gray-800 rounded-lg p-0.5 w-fit">
              {(['source', 'preview', ...(showDiff ? ['diff'] : [])] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === 'source' && (
              <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
                {iter.body}
              </div>
            )}
            {tab === 'preview' && (
              <EmailPreview subject={iter.subject} body={iter.body} fromName={fromName} />
            )}
            {tab === 'diff' && prevIter && (
              <DiffView prevSubject={prevIter.subject} currSubject={iter.subject} prevBody={prevIter.body} currBody={iter.body} />
            )}
          </div>

          {/* Changes */}
          {iter.changes_made && (
            <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-200">
              <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Changes</p>
              {iter.changes_made}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunDetailPage() {
  const params = useParams()
  const runId = params.id as string
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRun = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/run/${runId}`)
        if (!res.ok) throw new Error('Run not found')
        setRun(await res.json())
      } catch (e: any) {
        setError(e.message)
      }
      setLoading(false)
    }
    if (runId) fetchRun()
  }, [runId])

  const download = () => {
    if (!run?.final_subject || !run?.final_body) return
    const content = `Subject: ${run.final_subject}\n\n${run.final_body}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `run-${runId}-result.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusColor: Record<string, string> = {
    success: 'text-green-400',
    max_iterations: 'text-yellow-400',
    failed: 'text-red-400',
    cancelled: 'text-gray-400',
    interrupted: 'text-orange-400',
    running: 'text-blue-400',
    quick_check: 'text-purple-400',
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p>Loading run...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-red-300 flex items-center gap-3 max-w-md">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <div>
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    </div>
  )

  if (!run) return null

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/history" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-3 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to History
            </Link>
            <h1 className="text-xl font-bold text-white">
              Run <span className="font-mono text-blue-400">{runId}</span>
            </h1>
            <p className={`text-sm font-medium mt-1 capitalize ${statusColor[run.status] || 'text-gray-400'}`}>
              {run.status.replace('_', ' ')} · {run.total_iterations} iteration{run.total_iterations !== 1 ? 's' : ''}
            </p>
          </div>
          {run.final_subject && (
            <button
              onClick={download}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Download
            </button>
          )}
        </div>

        {/* Original email */}
        {run.original_subject && (
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Original Email</h2>
            <div>
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="text-white font-medium">{run.original_subject}</p>
            </div>
            {run.from_name && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Sender</p>
                <p className="text-gray-300 text-sm">{run.from_name} &lt;{run.from_email}&gt;</p>
              </div>
            )}
            {run.original_body && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Body</p>
                <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                  {run.original_body}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Iterations */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Iterations</h2>
          {run.iterations.length === 0 && (
            <p className="text-gray-500 text-sm">No iterations recorded.</p>
          )}
          {run.iterations.map((iter, i) => (
            <IterationDetail
              key={iter.iteration}
              iter={iter}
              prevIter={i > 0 ? run.iterations[i - 1] : null}
              fromName={run.from_name || ''}
            />
          ))}
        </div>

        {/* Final result */}
        {run.final_subject && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">
                {run.status === 'success' ? 'Final Email (Inbox-Ready)' : 'Best Version'}
              </h2>
              <div className="flex items-center gap-2">
                <CopyButton text={`Subject: ${run.final_subject}\n\n${run.final_body}`} />
                <button onClick={download} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Subject</p>
                  <CopyButton text={run.final_subject} />
                </div>
                <div className="bg-gray-800 rounded-lg px-4 py-3 text-white font-medium">{run.final_subject}</div>
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
      </main>
    </div>
  )
}
