'use client'

interface DiffViewProps {
  prevSubject: string
  currSubject: string
  prevBody: string
  currBody: string
}

type DiffToken = {
  text: string
  type: 'unchanged' | 'added' | 'removed'
}

/**
 * Simple LCS-based word-level diff.
 * Splits text into tokens (words and whitespace), computes LCS, then produces diff tokens.
 */
function tokenize(text: string): string[] {
  // Split into words and whitespace tokens so we can reconstruct spacing
  return text.split(/(\s+)/)
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  // Use a space-efficient approach: only keep two rows
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  return dp
}

function diffTokens(prev: string[], curr: string[]): DiffToken[] {
  // Limit to avoid O(n^2) on very large bodies — truncate tokens if too large
  const MAX_TOKENS = 600
  const a = prev.slice(0, MAX_TOKENS)
  const b = curr.slice(0, MAX_TOKENS)

  const dp = computeLCS(a, b)
  const result: DiffToken[] = []

  let i = a.length
  let j = b.length
  const stack: DiffToken[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ text: a[i - 1], type: 'unchanged' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ text: b[j - 1], type: 'added' })
      j--
    } else {
      stack.push({ text: a[i - 1], type: 'removed' })
      i--
    }
  }

  // Remaining tokens from longer original arrays (if truncated)
  if (prev.length > MAX_TOKENS) {
    stack.push({ text: '…(truncated)', type: 'unchanged' })
  }

  return stack.reverse()
}

function DiffLine({ tokens }: { tokens: DiffToken[] }) {
  return (
    <span>
      {tokens.map((tok, idx) => {
        if (tok.type === 'added') {
          return (
            <span key={idx} className="bg-green-900/40 text-green-300 rounded px-0.5">
              {tok.text}
            </span>
          )
        }
        if (tok.type === 'removed') {
          return (
            <span key={idx} className="bg-red-900/40 text-red-400 line-through rounded px-0.5">
              {tok.text}
            </span>
          )
        }
        return <span key={idx} className="text-gray-300">{tok.text}</span>
      })}
    </span>
  )
}

export default function DiffView({ prevSubject, currSubject, prevBody, currBody }: DiffViewProps) {
  const subjectTokens = diffTokens(tokenize(prevSubject), tokenize(currSubject))
  const bodyTokens = diffTokens(tokenize(prevBody), tokenize(currBody))

  const hasSubjectChange = subjectTokens.some(t => t.type !== 'unchanged')
  const hasBodyChange = bodyTokens.some(t => t.type !== 'unchanged')

  if (!hasSubjectChange && !hasBodyChange) {
    return (
      <div className="text-sm text-gray-500 italic px-3 py-2">
        No changes detected from previous iteration.
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm font-mono leading-relaxed">
      {/* Subject diff */}
      {hasSubjectChange && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Subject</p>
          <div className="bg-gray-800 rounded-lg px-3 py-2 break-words">
            <DiffLine tokens={subjectTokens} />
          </div>
        </div>
      )}

      {/* Body diff */}
      {hasBodyChange && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Body</p>
          <div className="bg-gray-800 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-64 overflow-y-auto break-words">
            <DiffLine tokens={bodyTokens} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-900/60 rounded"></span> Added
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-900/60 rounded"></span> Removed
        </span>
      </div>
    </div>
  )
}
