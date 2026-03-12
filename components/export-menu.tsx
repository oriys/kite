'use client'

import { Download, FileText, Code2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportMenuProps {
  documentId: string
  documentTitle: string
}

export function ExportMenu({ documentId }: ExportMenuProps) {
  const handleExport = (format: 'markdown' | 'html', theme?: 'light' | 'dark') => {
    const params = new URLSearchParams({
      documentId,
      format,
      ...(theme && { theme }),
    })
    window.open(`/api/export?${params}`, '_blank')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport('markdown')}>
          <FileText className="mr-2 h-4 w-4" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('html', 'light')}>
          <Code2 className="mr-2 h-4 w-4" />
          HTML (Light)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('html', 'dark')}>
          <Globe className="mr-2 h-4 w-4" />
          HTML (Dark)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
