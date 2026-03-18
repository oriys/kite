'use client'

import { Search } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { useSearchOpen } from '@/components/search-command'

export function SearchTrigger() {
  const openSearch = useSearchOpen()

  return (
    <InputGroup
      className="w-full sm:w-[340px] cursor-pointer"
      onClick={() => openSearch?.()}
    >
      <InputGroupAddon align="inline-start">
        <Search className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="Search docs…"
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
