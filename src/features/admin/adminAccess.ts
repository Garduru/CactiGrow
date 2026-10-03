import { createContext, useContext } from 'react'
import type { AdminSession } from '../../../shared/api/adminV1'
export interface AdminAccess { session: AdminSession | null; status: 'loading' | 'ready' | 'error'; refresh(): Promise<AdminSession | null> }
export const AdminAccessContext = createContext<AdminAccess>({ session: null, status: 'ready', refresh: async () => null })
export function useAdminAccess() { return useContext(AdminAccessContext) }
