'use client'

import { useState, useRef, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

interface ColorPickerProps {
  value: string                   // hex値
  onChange: (hex: string) => void
  label?: string
  showRgb?: boolean
  showAccessibility?: boolean
  contrastAgainst?: string        // 比較対象のhex
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}

export function ColorPicker({
  value,
  onChange,
  label,
  showRgb = false,
}: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // 外部からの value 変更に追従
  useEffect(() => {
    setHexInput(value)
  }, [value])

  const handlePickerChange = (hex: string) => {
    setHexInput(hex)
    // ピッカーからの変更はデバウンスして親に通知
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(hex), 50)
  }

  const handleHexInput = (inputValue: string) => {
    let hex = inputValue
    if (!hex.startsWith('#')) hex = '#' + hex
    setHexInput(hex)

    if (isValidHex(hex)) {
      onChange(hex)
    }
  }

  const hexToRgbStr = (hex: string) => {
    if (!isValidHex(hex)) return ''
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r}, ${g}, ${b}`
  }

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs font-medium text-gray-500">{label}</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-8 w-8 flex-shrink-0 rounded-md border border-gray-300 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            style={{ backgroundColor: isValidHex(value) ? value : '#888888' }}
            aria-label={label || 'カラーピッカーを開く'}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <HexColorPicker
            color={isValidHex(value) ? value : '#888888'}
            onChange={handlePickerChange}
          />
          <div className="mt-2">
            <Input
              value={hexInput}
              onChange={(e) => handleHexInput(e.target.value)}
              placeholder="#000000"
              maxLength={7}
              className="h-8 font-mono text-xs"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* HEX値テキスト表示 */}
      <span className="font-mono text-xs text-gray-600">
        {isValidHex(value) ? value.toUpperCase() : value}
      </span>

      {/* RGB値表示 */}
      {showRgb && isValidHex(value) && (
        <span className="text-xs text-gray-400">
          ({hexToRgbStr(value)})
        </span>
      )}
    </div>
  )
}
