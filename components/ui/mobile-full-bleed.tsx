import type { ReactNode } from 'react'

interface MobileFullBleedProps {
  children: ReactNode
}

export function MobileFullBleed({ children }: MobileFullBleedProps) {
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0 md:overflow-visible">
      <div className="inline-block min-w-full pl-4 pr-4 md:pl-0 md:pr-0">
        {children}
      </div>
    </div>
  )
}
