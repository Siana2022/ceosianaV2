import type { ReactNode } from 'react'
import TareasShell from './TareasShell'

export default function TareasLayout({ children }: { children: ReactNode }) {
  return <TareasShell>{children}</TareasShell>
}
