import React, { useRef, useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'
import { describe, test, expect, vi } from 'vitest'

function TestComponent({ defaultOpen = true, onClose }) {
  const ref = useRef(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  useFocusTrap(ref, isOpen, () => {
    setIsOpen(false)
    if (onClose) onClose()
  })

  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      {isOpen && (
        <div ref={ref} data-testid="modal">
          <input data-testid="input-1" placeholder="First" />
          <button data-testid="input-2">Second</button>
          <a href="#" data-testid="input-3">Third</a>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  test('should focus the first element on mount when open', () => {
    render(<TestComponent />)
    const firstInput = screen.getByTestId('input-1')
    expect(document.activeElement).toBe(firstInput)
  })

  test('should restore focus to the previously active element on unmount', () => {
    const outsideBtn = document.createElement('button')
    document.body.appendChild(outsideBtn)
    outsideBtn.focus()
    expect(document.activeElement).toBe(outsideBtn)

    const { unmount } = render(<TestComponent />)
    expect(document.activeElement).not.toBe(outsideBtn)

    unmount()
    expect(document.activeElement).toBe(outsideBtn)
    document.body.removeChild(outsideBtn)
  })

  test('should cycle focus forward to first element when Tab is pressed on last element', () => {
    render(<TestComponent />)
    const first = screen.getByTestId('input-1')
    const third = screen.getByTestId('input-3')

    third.focus()
    expect(document.activeElement).toBe(third)

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    document.dispatchEvent(event)

    expect(document.activeElement).toBe(first)
  })

  test('should cycle focus backward to last element when Shift+Tab is pressed on first element', () => {
    render(<TestComponent />)
    const first = screen.getByTestId('input-1')
    const third = screen.getByTestId('input-3')

    first.focus()
    expect(document.activeElement).toBe(first)

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(document.activeElement).toBe(third)
  })

  test('should trigger onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<TestComponent onClose={onClose} />)

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(onClose).toHaveBeenCalled()
  })
})
