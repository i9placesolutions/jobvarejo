// User roles
export type UserRole = 'super_admin' | 'admin' | 'user'

// Profile interface
export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// Auth user with profile
export interface UserWithProfile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: UserRole
}

// Session state
export interface AuthState {
  user: UserWithProfile | null
  isAuthenticated: boolean
  isLoading: boolean
}
