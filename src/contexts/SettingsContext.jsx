import React, { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { decryptToken, encryptToken } from '../utils/crypto'
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [isN8nMode, setIsN8nMode] = useState(false)
  const [n8nUrl, setN8nUrl] = useState('')
  const [n8nToken, setN8nToken] = useState('')
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const initSettings = async () => {
      const savedN8nMode = safeGetItem('spend_n8n_mode') === 'true'
      const savedN8nUrl = safeGetItem('spend_n8n_url') || ''
      const savedN8nTokenEncrypted = localStorage.getItem('spend_n8n_token_enc') || sessionStorage.getItem('spend_n8n_token_enc') || ''
      const savedTheme = safeGetItem('spend_theme') || 'dark'

      let decryptedToken = await decryptToken(savedN8nTokenEncrypted)
      
      if (!decryptedToken) {
        const legacyToken = safeGetItem('spend_n8n_token')
        if (legacyToken) {
          decryptedToken = legacyToken
          const encrypted = await encryptToken(legacyToken)
          localStorage.setItem('spend_n8n_token_enc', encrypted)
          safeRemoveItem('spend_n8n_token')
        }
      } else {
        const encrypted = await encryptToken(decryptedToken)
        localStorage.setItem('spend_n8n_token_enc', encrypted)
      }
      
      setIsN8nMode(savedN8nMode)
      setN8nUrl(savedN8nUrl)
      setN8nToken(decryptedToken)
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    initSettings()
  }, [])

  const toggleN8nMode = useCallback(async (enabled) => {
    setIsN8nMode(enabled)
    safeSetItem('spend_n8n_mode', enabled)
  }, [])

  const updateN8nUrl = useCallback(async (url) => {
    setN8nUrl(url)
    safeSetItem('spend_n8n_url', url)
  }, [])

  const updateN8nToken = useCallback(async (token) => {
    setN8nToken(token)
    const encrypted = await encryptToken(token)
    localStorage.setItem('spend_n8n_token_enc', encrypted)
    safeRemoveItem('spend_n8n_token')
  }, [])

  const toggleTheme = useCallback(async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    safeSetItem('spend_theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }, [theme])

  return (
    <SettingsContext.Provider value={{
      isN8nMode,
      setIsN8nMode: toggleN8nMode,
      n8nUrl,
      setN8nUrl: updateN8nUrl,
      n8nToken,
      setN8nToken: updateN8nToken,
      theme,
      toggleTheme,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}