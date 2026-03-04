'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface ToolsHeaderProps {
  onSignOut?: () => void
  showSignOut?: boolean
}

export function ToolsHeader({ onSignOut, showSignOut = false }: ToolsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/tools/colors"
          className="text-lg font-bold text-gray-900 no-underline hover:opacity-80"
        >
          brandconnect
          <span className="ml-2 text-sm font-normal text-gray-500">
            カラー定義ツール
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
