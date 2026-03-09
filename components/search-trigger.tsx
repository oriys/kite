'use client'

import { Search } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

export function SearchTrigger() {
  return (
    <InputGroup
      className="w-full sm:w-[340px] cursor-pointer"
      onClick={() => {
        document.querySelector<HTMLButtonElement>('[data-slot="search-trigger"]')?.click()
      }}
    >
      <InputGroupAddon align="inline-start">
        <Search className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="Search tokens, patterns, and blocks"
        readOnly
        className="cursor-pointer"
      />
      <InputGroupAddon align="inline-end">
        <KbdGroup>
          <Kbd>Cmd</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </InputGroupAddon>
    </InputGroup>
  )
}
