export const DEV_MOCK_AUTH_ENABLED = process.env.ENABLE_MOCK_AUTH === 'true'

export interface DevMockUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
}

export const DEV_MOCK_USERS: readonly DevMockUser[] = [
  {
    id: '0a95ee7c-6aee-4a69-bc15-b54d75d52e11',
    name: 'oriys',
    email: 'kirin.toudou@protonmail.com',
    role: 'owner',
  },
  {
    id: 'mock-alina-chen',
    name: 'Alina Chen',
    email: 'alina.chen+mock@kite.local',
    role: 'admin',
  },
  {
    id: 'mock-mateo-silva',
    name: 'Mateo Silva',
    email: 'mateo.silva+mock@kite.local',
    role: 'member',
  },
  {
    id: 'mock-nina-park',
    name: 'Nina Park',
    email: 'nina.park+mock@kite.local',
    role: 'member',
  },
] as const
