'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutTemplate, Plus, Trash2, RefreshCw, Copy, Check,
  ChevronDown, ChevronUp, X, AlertTriangle, ExternalLink,
} from 'lucide-react'

interface Template {
  id: number
  name: string
  subject: string
  body: string
  created_at: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function TemplateCard({
  template,
  onDelete,
  onUse,
}: {
  template: Template
  onDelete: (id: number) => void
  onUse: (t: Template) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete template "${template.name}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
      onDelete(template.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div
        className="px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{template.name}</p>
          <p className="text-gray-400 text-xs mt-0.5 truncate">{template.subject}</p>
          <p className="text-gray-600 text-xs mt-0.5">{formatDate(template.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onUse(template) }}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Use
          </button>
          <CopyButton text={`Subject: ${template.subject}\n\n${template.body}`} />
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/50 space-y-4 pt-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Subject</p>
              <CopyButton text={template.subject} />
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-2.5 text-white text-sm font-medium">
              {template.subject}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Body</p>
              <CopyButton text={template.body} />
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
              {template.body}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleDelete = (id: number) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const handleUse = (t: Template) => {
    // Store in localStorage for the home page to pick up
    localStorage.setItem('apeo_template_subject', t.subject)
    localStorage.setItem('apeo_template_body', t.body)
    router.push('/')
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) {
      setCreateError('All fields are required.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, subject: newSubject, body: newBody }),
      })
      if (!res.ok) throw new Error('Failed to create template')
      const created = await res.json()
      setTemplates((prev) => [created, ...prev])
      setNewName('')
      setNewSubject('')
      setNewBody('')
      setShowCreate(false)
    } catch (e: any) {
      setCreateError(e.message)
    }
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="font-bold text-white text-xl">Templates</h1>
              <p className="text-gray-400 text-sm">{templates.length} saved template{templates.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Create Template</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My template name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Subject</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Email subject line"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Body</label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Email body content..."
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono resize-y"
              />
            </div>

            {createError && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {createError}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p>Loading templates...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && templates.length === 0 && !showCreate && (
          <div className="text-center py-20 text-gray-500">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm mt-1">Create a template or save a run result as a template.</p>
          </div>
        )}

        {/* Grid */}
        {!loading && templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onDelete={handleDelete}
                onUse={handleUse}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
