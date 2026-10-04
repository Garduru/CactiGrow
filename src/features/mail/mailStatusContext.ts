import { createContext, useContext } from 'react'
export const MailStatus = createContext<{ unread: number | null; setUnread(value: number): void }>({ unread: null, setUnread() {} })
export const useMailStatus = () => useContext(MailStatus)
