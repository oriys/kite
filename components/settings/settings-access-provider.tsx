'use client'

import * as React from 'react'

export type SettingsRole = 'owner' | 'admin' | 'member' | 'guest'

interface SettingsAccessValue {
  currentRole: SettingsRole
  workspaceId: string
}

const SettingsAccessContext = React.createContext<SettingsAccessValue | null>(null)

export function SettingsAccessProvider({
  children,
  currentRole,
  workspaceId,
}: SettingsAccessValue & { children: React.ReactNode }) {
  return (
    <SettingsAccessContext.Provider value={{ currentRole, workspaceId }}>
      {children}
    </SettingsAccessContext.Provider>
  )
}

export function useSettingsAccess() {
  const value = React.useContext(SettingsAccessContext)

  if (!value) {
    throw new Error('useSettingsAccess must be used within SettingsAccessProvider')
  }

  return value
}
