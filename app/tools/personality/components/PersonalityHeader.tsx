'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface PersonalityHeaderProps {
  onSignOut?: () => void
  showSignOut?: boolean
}

export function PersonalityHeader({ onSignOut, showSignOut = false }: PersonalityHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link
          href="/tools/personality"
          className="flex items-center no-underline hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="branding.bz" style={{ height: '22px', width: 'auto', position: 'relative', top: '-2px' }} />
          <span className="ml-2 text-sm font-normal text-gray-500">
            ブランドパーソナリティ診断
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
