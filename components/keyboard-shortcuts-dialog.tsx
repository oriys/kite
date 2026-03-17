'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShortcutGroup {
  label: string
  shortcuts: {
    description: string
    keys: string[]
  }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'General',
    shortcuts: [
      { description: 'Show keyboard shortcuts', keys: ['⌘', '/'] },
      { description: 'Open command palette', keys: ['⌘', 'K'] },
      { description: 'Save', keys: ['⌘', 'S'] },
      { description: 'Toggle sidebar', keys: ['⌘', '\\'] },
    ],
  },
  {
    label: 'Navigation & View',
    shortcuts: [
      { description: 'Switch to WYSIWYG', keys: ['Alt', '1'] },
      { description: 'Switch to Source', keys: ['Alt', '2'] },
      { description: 'Switch to Split View', keys: ['Alt', '3'] },
      { description: 'Focus Editor / Preview', keys: ['Ctrl', 'Tab'] },
    ],
  },
  {
    label: 'Editing',
    shortcuts: [
      { description: 'Bold', keys: ['⌘', 'B'] },
      { description: 'Italic', keys: ['⌘', 'I'] },
      { description: 'Link', keys: ['⌘', 'K'] },
      { description: 'Inline Code', keys: ['⌘', 'E'] },
      { description: 'Code Block', keys: ['⌘', 'Shift', 'C'] },
    ],
  },
  {
    label: 'Structure & Tables',
    shortcuts: [
      { description: 'Move Line Up', keys: ['Alt', '↑'] },
      { description: 'Move Line Down', keys: ['Alt', '↓'] },
      { description: 'Add Row Below', keys: ['⌘', 'Enter'] },
      { description: 'Add Row Above', keys: ['⌘', 'Shift', 'Enter'] },
      { description: 'Delete Row', keys: ['⌘', 'Backspace'] },
    ],
  },
]

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Master the editor with these keyboard combinations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 md:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">{group.label}</h4>
              <div className="grid gap-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground/90">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
