'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  Quote, Link2, Undo, Redo, Code,
} from 'lucide-react'

interface HtmlEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

export function HtmlEditor({ value, onChange, placeholder, className, minHeight = 250 }: HtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  // Sync external value → editor content when value changes externally
  // (e.g., when "Charger un modèle" button sets a preset)
  useEffect(() => {
    if (!editorRef.current) return
    if (isInternalChange.current) return
    // Only update if the new value differs from what's already in the editor
    const current = editorRef.current.innerHTML
    if (value !== current) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  // Handle input
  const handleInput = () => {
    if (!editorRef.current) return
    isInternalChange.current = true
    onChange(editorRef.current.innerHTML)
    setTimeout(() => { isInternalChange.current = false }, 0)
  }

  // Execute a document command
  const exec = (command: string, val?: string) => {
    document.execCommand(command, false, val)
    handleInput()
    editorRef.current?.focus()
  }

  // Insert link
  const insertLink = () => {
    const url = window.prompt('URL du lien :', 'https://')
    if (url) {
      exec('createLink', url)
    }
  }

  // Insert HTML snippet
  const insertHtml = (html: string) => {
    exec('insertHTML', html)
  }

  // Format block (h1, h2, blockquote, p)
  const formatBlock = (tag: string) => {
    exec('formatBlock', tag)
  }

  const toolbarBtn = (onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      title={title}
    >
      {icon}
    </button>
  )

  return (
    <div className={cn('rounded-md border border-input overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap p-1.5 border-b bg-muted/30">
        {toolbarBtn(() => exec('bold'), <Bold className="h-4 w-4" />, 'Gras (Ctrl+B)')}
        {toolbarBtn(() => exec('italic'), <Italic className="h-4 w-4" />, 'Italique (Ctrl+I)')}
        {toolbarBtn(() => exec('underline'), <Underline className="h-4 w-4" />, 'Souligné (Ctrl+U)')}

        <div className="w-px h-5 bg-border mx-1" />

        {toolbarBtn(() => formatBlock('h1'), <Heading1 className="h-4 w-4" />, 'Titre 1')}
        {toolbarBtn(() => formatBlock('h2'), <Heading2 className="h-4 w-4" />, 'Titre 2')}
        {toolbarBtn(() => formatBlock('p'), <span className="text-xs font-medium">P</span>, 'Paragraphe')}

        <div className="w-px h-5 bg-border mx-1" />

        {toolbarBtn(() => exec('insertUnorderedList'), <List className="h-4 w-4" />, 'Liste à puces')}
        {toolbarBtn(() => exec('insertOrderedList'), <ListOrdered className="h-4 w-4" />, 'Liste numérotée')}
        {toolbarBtn(() => formatBlock('blockquote'), <Quote className="h-4 w-4" />, 'Citation')}

        <div className="w-px h-5 bg-border mx-1" />

        {toolbarBtn(insertLink, <Link2 className="h-4 w-4" />, 'Lien')}
        {toolbarBtn(() => exec('removeFormat'), <Code className="h-4 w-4" />, 'Effacer le format')}

        <div className="w-px h-5 bg-border mx-1" />

        {toolbarBtn(() => exec('undo'), <Undo className="h-4 w-4" />, 'Annuler (Ctrl+Z)')}
        {toolbarBtn(() => exec('redo'), <Redo className="h-4 w-4" />, 'Rétablir (Ctrl+Y)')}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="p-3 outline-none prose prose-sm max-w-none focus:ring-1 focus:ring-ring overflow-y-auto"
        style={{ minHeight: `${minHeight}px` }}
      />

      {/* CSS for placeholder + prose styling inside the editor */}
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        [contenteditable] h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        [contenteditable] p { margin: 0.5rem 0; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] blockquote { border-left: 3px solid hsl(var(--border)); padding-left: 1rem; margin: 0.5rem 0; color: hsl(var(--muted-foreground)); font-style: italic; }
        [contenteditable] a { color: hsl(var(--primary)); text-decoration: underline; }
      `}</style>
    </div>
  )
}
