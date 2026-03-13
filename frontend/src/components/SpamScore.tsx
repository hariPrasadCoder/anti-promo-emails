'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface SpamScoreProps {
  score: number
  issues: string[]
  verdict: string
}

export default function SpamScore({ score, issues, verdict }: SpamScoreProps) {
  const [expanded, setExpanded] = useState(false)

  const colorClass =
    verdict === 'good'
      ? 'text-green-400 border-green-700 bg-green-900/20'
      : verdict === 'warning'
      ? 'text-yellow-400 border-yellow-700 bg-yellow-900/20'
      : 'text-red-400 border-red-700 bg-red-900/20'

  const ringClass =
    verdict === 'good'
      ? 'stroke-green-500'
      : verdict === 'warning'
      ? 'stroke-yellow-500'
      : 'stroke-red-500'

  const VerdictIcon =
    verdict === 'good' ? CheckCircle : verdict === 'warning' ? AlertTriangle : XCircle

  // SVG circle progress
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = ((100 - score) / 100) * circumference

  return (
    <div className={`rounded-lg border ${colorClass} px-3 py-2.5`}>
      <div className="flex items-center gap-3">
        {/* Circle gauge */}
        <div className="relative shrink-0">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle
              cx="24" cy="24" r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="4"
            />
            <circle
              cx="24" cy="24" r={radius}
              fill="none"
              className={ringClass}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {score}
          </span>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <VerdictIcon className="w-4 h-4" />
            <span className="font-semibold text-sm capitalize">{verdict}</span>
            <span className="text-xs opacity-60">spam score</span>
          </div>
          {issues.length > 0 && (
            <p className="text-xs opacity-70 mt-0.5 truncate">
              {issues.length} issue{issues.length !== 1 ? 's' : ''} found
            </p>
          )}
          {issues.length === 0 && (
            <p className="text-xs opacity-70 mt-0.5">No issues detected</p>
          )}
        </div>

        {/* Expand toggle */}
        {issues.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Issues list */}
      {expanded && issues.length > 0 && (
        <ul className="mt-2.5 pt-2.5 border-t border-current border-opacity-20 space-y-1.5">
          {issues.map((issue, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs opacity-80">
              <span className="mt-0.5 shrink-0">•</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
