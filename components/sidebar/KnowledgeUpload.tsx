'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Upload, FileText, Trash2, CheckCircle, Loader2, Database } from 'lucide-react'
import { motion } from 'framer-motion'
import type { KnowledgeDocument } from '@/lib/types'

interface Props {
  onClose: () => void
}

export default function KnowledgeUpload({ onClose }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedId, setUploadedId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(d => setDocuments(d.documents || []))
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadedId(null)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/knowledge', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) {
      setUploadError(data.error)
      setUploading(false)
      return
    }
    setDocuments(prev => [data.document, ...prev])
    setUploadedId(data.document.id)
    setUploading(false)
    setTimeout(() => setUploadedId(null), 3000)
  }, [])

  const deleteDoc = useCallback(async (id: string) => {
    await fetch('/api/knowledge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDocuments(prev => prev.filter(d => d.id !== id))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#2f2f2f] rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-model-gpt/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-model-gpt" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Wissensdatenbank</h2>
              <p className="text-xs text-gray-400">{documents.length} Dokument{documents.length !== 1 ? 'e' : ''} geladen</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload area */}
        <div className="p-5">
          <label
            className={`flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isDragging ? 'border-model-gpt bg-model-gpt/10' : 'border-border hover:border-gray-500 hover:bg-white/5'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
          >
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-model-gpt animate-spin" />
                <p className="text-sm text-gray-400">Dokument wird indiziert…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-300">Datei hier ablegen oder klicken</p>
                <p className="text-xs text-gray-500">TXT, MD, PDF, DOCX</p>
              </div>
            )}
          </label>

          {uploadError && (
            <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {uploadError}
            </p>
          )}

          {/* Document list */}
          {documents.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-border group"
                >
                  <div className="w-7 h-7 rounded-lg bg-model-gpt/20 flex items-center justify-center flex-shrink-0">
                    {uploadedId === doc.id ? (
                      <CheckCircle className="w-4 h-4 text-model-gpt" />
                    ) : (
                      <FileText className="w-4 h-4 text-model-gpt" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.chunks} Abschnitte · {(doc.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-model-gpt text-white text-sm font-medium hover:bg-model-gpt/90 transition-colors"
          >
            Fertig
          </button>
        </div>
      </motion.div>
    </div>
  )
}
