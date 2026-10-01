'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  tareaId?: string
}

function ToolBtn({ active, title, onClick, children }: {
  active?: boolean
  title: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(e) }}
      className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-700 mx-0.5 self-center" />
}

export default function RichTextEditor({ value, onChange, placeholder, tareaId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-400 underline cursor-pointer' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded my-2' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe una descripción...' }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  const insertLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace:', prev ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run()
    }
  }, [editor])

  const insertImage = useCallback(async (file: File) => {
    if (!editor || uploadingRef.current) return
    uploadingRef.current = true
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (tareaId) fd.append('tareaId', tareaId)
      const res = await fetch('/api/tareas/imagenes', { method: 'POST', body: fd })
      if (!res.ok) return
      const data = await res.json()
      if (data.url) editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
    } catch (e) {
      console.error('[RTE] imagen error', e)
    } finally {
      uploadingRef.current = false
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [editor, tareaId])

  if (!editor) return null

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus-within:border-blue-500 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 bg-gray-850">

        {/* Headings */}
        <ToolBtn active={editor.isActive('heading', { level: 1 })} title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 2 })} title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} title="Título 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

        <Divider />

        {/* Inline */}
        <ToolBtn active={editor.isActive('bold')} title="Negrita (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolBtn>
        <ToolBtn active={editor.isActive('italic')} title="Cursiva (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolBtn>
        <ToolBtn active={editor.isActive('underline')} title="Subrayado (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive('strike')} title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive('code')} title="Código inline" onClick={() => editor.chain().focus().toggleCode().run()}>{'<>'}</ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn active={editor.isActive('bulletList')} title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()}>• —</ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolBtn>
        <ToolBtn active={editor.isActive('blockquote')} title="Cita" onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</ToolBtn>
        <ToolBtn active={editor.isActive('codeBlock')} title="Bloque de código" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</ToolBtn>

        <Divider />

        {/* Align */}
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} title="Alinear izquierda" onClick={() => editor.chain().focus().setTextAlign('left').run()}>⬅</ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} title="Centrar" onClick={() => editor.chain().focus().setTextAlign('center').run()}>⬛</ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'right' })} title="Alinear derecha" onClick={() => editor.chain().focus().setTextAlign('right').run()}>➡</ToolBtn>

        <Divider />

        {/* Link */}
        <ToolBtn active={editor.isActive('link')} title="Insertar enlace" onClick={insertLink}>🔗</ToolBtn>

        {/* Image upload */}
        <ToolBtn title="Subir imagen" onClick={() => fileRef.current?.click()}>🖼</ToolBtn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) insertImage(file)
          }}
        />

        <Divider />

        {/* History */}
        <ToolBtn title="Deshacer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>↩</ToolBtn>
        <ToolBtn title="Rehacer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>↪</ToolBtn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="min-h-[100px] max-h-64 overflow-y-auto px-3 py-2 outline-none prose-sm prose-invert prose-p:my-1 prose-headings:font-bold"
      />

      <style>{`
        .ProseMirror { outline: none; min-height: 100px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #4b5563;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror h1 { font-size: 1.4em; font-weight: 700; margin: 0.4em 0; }
        .ProseMirror h2 { font-size: 1.2em; font-weight: 700; margin: 0.35em 0; }
        .ProseMirror h3 { font-size: 1.05em; font-weight: 600; margin: 0.3em 0; }
        .ProseMirror ul { list-style: disc; padding-left: 1.4em; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.4em; }
        .ProseMirror blockquote { border-left: 3px solid #4b5563; padding-left: 0.8em; color: #9ca3af; margin: 0.4em 0; }
        .ProseMirror code { background: #1f2937; border-radius: 3px; padding: 0.1em 0.35em; font-family: monospace; font-size: 0.85em; }
        .ProseMirror pre { background: #111827; border-radius: 6px; padding: 0.75em 1em; margin: 0.5em 0; overflow-x: auto; }
        .ProseMirror pre code { background: none; padding: 0; }
        .ProseMirror img { max-width: 100%; border-radius: 6px; margin: 0.4em 0; }
        .ProseMirror a { color: #60a5fa; text-decoration: underline; }
        .ProseMirror p { margin: 0.2em 0; }
      `}</style>
    </div>
  )
}
