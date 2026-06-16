import { useEffect } from 'react'

export function useFocusTrap(ref, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !ref.current) return

    const container = ref.current
    const previouslyActiveElement = document.activeElement

    // Query all focusable children
    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[tabindex="0"]',
      '[contenteditable]'
    ]
    
    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll(focusableSelectors.join(',')))
        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
    }

    const focusableElements = getFocusableElements()
    
    // Auto-focus the first element (or the close button, or the container)
    if (focusableElements.length > 0) {
      // If there is an input with autofocus/required, let's find it, else focus first
      const autoFocusEl = focusableElements.find(el => el.hasAttribute('autofocus')) || focusableElements[0]
      autoFocusEl.focus()
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) onClose()
        return
      }

      if (e.key !== 'Tab') return

      const currentElements = getFocusableElements()
      if (currentElements.length === 0) {
        e.preventDefault()
        return
      }

      const firstElement = currentElements[0]
      const lastElement = currentElements[currentElements.length - 1]

      if (e.shiftKey) {
        // Shift + Tab: Go backward
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        // Tab: Go forward
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to previously active element on close
      if (previouslyActiveElement && typeof previouslyActiveElement.focus === 'function') {
        previouslyActiveElement.focus()
      }
    }
  }, [isOpen, ref, onClose])
}
