'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle, XCircle, Clock, Trash2, RefreshCw, ChevronDown, ChevronUp,
  ExternalLink, History, AlertTriangle,
} from 'lucide-react'

interface RunSummary {
  run_id: string
  status: string
  from_name: string | null
  from_email: string | null
  original_subject: string | null
  total_iterations: number
  created_at: string | null
  updated_at: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    success: { label: 'Inbox', color: 'bg-green-900/50 text-green-300 border-green-700' },
    max_iterations: { label: 'Max Iters', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
    failed: { label: 'Failed', color: 'bg-red-900/50 text-red-300 border-red-700' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-800 text-gray-400 border-gray-600' },
    interrupted: { label: 'Interrupted', color: 'bg-orange-900/50 text-orange-300 border-orange-700' },
    running: { label: 'Running', color: 'bg-blue-900/50 text-blue-300 border-blue-700' },
    quick_check: { label: 'Quick Check', color: 'bg-purple-900/50 text-purple-300 border-purple-700' },
    pending: { label: 'Pending', color: 'bg-gray-800 text-gray-400 border-gray-600' },
  }
  const { label, color } = map[status] || { label: status, color: 'bg-gray-800 text-gray-400 border-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function RunRow({ run, onDelete }: { run: RunSummary; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this run?')) return
    setDeleting(true)
    try {
      await fetch(`/api/run/${run.run_id}`, { method: 'DELETE' })
      onDelete(run.run_id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Date */}
        <div className="text-xs text-gray-500 w-36 shrink-0">
          {formatDate(run.created_at)}
        </div>

        {/* Subject */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">
            {run.original_subject || '(no subject)'}
          </p>
          {run.from_name && (
            <p className="text-gray-500 text-xs truncate">{run.from_name} &lt;{run.from_email}&gt;</p>
          )}
        </div>

        {/* Status + iterations */}
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={run.status} />
          <span className="text-xs text-gray-500 w-16 text-right">
            {run.total_iterations} iter{run.total_iterations !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/run/${run.run_id}`}
            className="text-gray-400 hover:text-blue-400 transition-colors"
            title="View full detail"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
            title="Delete run"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Expand arrow */}
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-5 py-4 border-t border-gray-700/50 text-sm text-gray-400 space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Run ID</p>
              <p className="font-mono text-gray-300">{run.run_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Updated</p>
              <p>{formatDate(run.updated_at)}</p>
            </div>
          </div>
          <Link
            href={`/run/${run.run_id}`}
            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm mt-2"
          >
            View full detail <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRuns = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/runs')
      if (!res.ok) throw new Error('Failed to load runs')
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  const handleDelete = (id: string) => {
    setRuns((prev) => prev.filter((r) => r.run_id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="font-bold text-white text-xl">Run History</h1>
              <p className="text-gray-400 text-sm">{runs.length} total run{runs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={fetchRuns}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p>Loading runs...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No runs yet</p>
            <p className="text-sm mt-1">Start your first optimization run from the home page.</p>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-4 px-5 py-2 text-xs text-gray-500 uppercase tracking-wider">
              <div className="w-36 shrink-0">Date</div>
              <div className="flex-1">Subject / Sender</div>
              <div className="w-32 text-right">Status / Iters</div>
              <div className="w-16" />
            </div>
            {runs.map((run) => (
              <RunRow key={run.run_id} run={run} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
