'use client'

import { useRef, useEffect, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isUserEdit = useRef(false)

  useEffect(() => {
    if (ref.current && !isUserEdit.current) {
      ref.current.innerHTML = value
    }
    isUserEdit.current = false
  }, [value])

  const handleInput = useCallback(() => {
    if (!ref.current) return
    isUserEdit.current = true
    onChange(ref.current.innerHTML)
  }, [onChange])

  function cmd(command: string) {
    if (typeof document === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false)
    ref.current?.focus()
    handleInput()
  }

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus-within:border-blue-500 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-700">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); cmd('bold') }}
          className="font-bold text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Negrita (Ctrl+B)"
        >B</button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); cmd('italic') }}
          className="italic text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Cursiva (Ctrl+I)"
        >I</button>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); cmd('insertUnorderedList') }}
          className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Lista"
        >• Lista</button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); cmd('insertOrderedList') }}
          className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Lista numerada"
        >1. Lista</button>
      </div>
      {/* Editor */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[80px] max-h-48 overflow-y-auto px-3 py-2 outline-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #4b5563;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
