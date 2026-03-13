'use client'

import * as React from 'react'
import { RotateCcw } from 'lucide-react'

import { oklchToHex, hexToOklch, isValidHex } from '@/lib/color-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ColorInputProps {
  /** Current override value as an OKLCH string, or null when using defaults */
  value: string | null
  /** Default OKLCH value from globals.css to show when value is null */
  defaultValue: string
  /** Called with OKLCH string or null (reset) */
  onChange: (oklch: string | null) => void
  className?: string
}

export function ColorInput({
  value,
  defaultValue,
  onChange,
  className,
}: ColorInputProps) {
  const colorInputRef = React.useRef<HTMLInputElement>(null)

  const oklch = value ?? defaultValue
  const hex = oklchToHex(oklch)
  const [inputValue, setInputValue] = React.useState(hex)
  const isOverridden = value !== null

  // Sync input when prop changes externally
  React.useEffect(() => {
    setInputValue(oklchToHex(value ?? defaultValue))
  }, [value, defaultValue])

  const handleHexBlur = React.useCallback(() => {
    if (isValidHex(inputValue)) {
      const newOklch = hexToOklch(inputValue)
      onChange(newOklch)
    } else {
      // Reset to current value
      setInputValue(hex)
    }
  }, [inputValue, hex, onChange])

  const handleHexKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleHexBlur()
      }
    },
    [handleHexBlur],
  )

  const handleNativeColorChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newHex = e.target.value
      setInputValue(newHex)
      onChange(hexToOklch(newHex))
    },
    [onChange],
  )

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Color swatch — opens native picker */}
      <button
        type="button"
        className="relative size-8 shrink-0 rounded-md border border-border/80 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none"
        style={{ backgroundColor: hex }}
        onClick={() => colorInputRef.current?.click()}
        aria-label="Open color picker"
      >
        <input
          ref={colorInputRef}
          type="color"
          value={hex}
          onChange={handleNativeColorChange}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </button>

      {/* Hex text input */}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleHexBlur}
        onKeyDown={handleHexKeyDown}
        className="h-8 w-28 font-mono text-xs"
        spellCheck={false}
      />

      {/* Reset button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => onChange(null)}
        disabled={!isOverridden}
        aria-label="Reset to default"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  )
}
