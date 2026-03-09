'use client'

import * as React from 'react'
import { FileIcon, FolderIcon, FileJson, FileType } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface FileTreeProps {
  data: TreeItem[]
  className?: string
}

type TreeItem = {
  id: string
  name: string
  type: 'file' | 'folder'
  children?: TreeItem[]
}

export function FileTree({ data, className }: FileTreeProps) {
  return (
    <div className={cn('overflow-hidden rounded-md border bg-background', className)}>
      <div className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
        File Structure
      </div>
      <div className="p-2">
        {data.map((item) => (
          <TreeItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function TreeItem({ item, level = 0 }: { item: TreeItem; level?: number }) {
  const [isOpen, setIsOpen] = React.useState(false)

  if (item.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50',
              level > 0 && 'ml-4'
            )}
            style={{ paddingLeft: level ? `${level * 12 + 8}px` : '8px' }}
          >
            <FolderIcon className="h-4 w-4 text-blue-500 fill-blue-500/20" />
            <span className="font-medium">{item.name}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {item.children?.map((child) => (
            <TreeItem key={child.id} item={child} level={level + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted/50',
        level > 0 && 'ml-4'
      )}
      style={{ paddingLeft: level ? `${level * 12 + 8}px` : '8px' }}
    >
      <FileIcon className="h-4 w-4" />
      <span>{item.name}</span>
    </div>
  )
}
