'use client'

import { useState } from 'react'
import { Eye, Code } from 'lucide-react'

interface EmailPreviewProps {
  subject: string
  body: string
  fromName: string
}

export default function EmailPreview({ subject, body, fromName }: EmailPreviewProps) {
  const [view, setView] = useState<'preview' | 'source'>('preview')

  const isHtml = body.trim().startsWith('<')

  // Wrap plain text in minimal HTML for iframe display
  const htmlContent = isHtml
    ? body
    : `<html><body style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;padding:16px 20px;max-width:600px">${body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .split(/\n{2,}/)
        .map(p => `<p style="margin:0 0 1em">${p.replace(/\n/g, '<br>')}</p>`)
        .join('')}</body></html>`

  return (
    <div className="space-y-2">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 space-y-0.5">
          <div><span className="text-gray-500">From:</span> {fromName}</div>
          <div><span className="text-gray-500">Subject:</span> <span className="text-white font-medium">{subject}</span></div>
        </div>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setView('source')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'source' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Source
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'preview' ? (
        <iframe
          sandbox="allow-same-origin"
          srcDoc={htmlContent}
          className="w-full h-64 rounded-lg border border-gray-700 bg-white"
          title="Email preview"
        />
      ) : (
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
          {body}
        </div>
      )}
    </div>
  )
}
