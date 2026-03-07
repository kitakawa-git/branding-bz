'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface STPHeaderProps {
  onSignOut?: () => void
  showSignOut?: boolean
}

export function STPHeader({ onSignOut, showSignOut = false }: STPHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link
          href="/tools/stp"
          className="text-lg font-bold text-gray-900 no-underline hover:opacity-80"
        >
          branding.bz
          <span className="ml-2 text-sm font-normal text-gray-500">
            STP分析ツール
          </span>
        </Link>

        {showSignOut && onSignOut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            ログアウト
          </Button>
        )}
      </div>
    </header>
  )
}
