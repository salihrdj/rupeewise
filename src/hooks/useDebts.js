import { useState, useCallback, useEffect } from 'react'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { validateDebts } from '../schemas/n8nResponse'

export function useDebts() {
  const [debts, setDebts] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initDebts = () => {
      const localDebts = safeGetItem('spend_debts')
      if (localDebts) {
        try {
          const parsed = JSON.parse(localDebts)
          const validation = validateDebts(parsed)
          if (validation.success) {
            setDebts(validation.data.filter(d => d && d.syncPending !== 'delete'))
          } else {
            console.error('Debts validation failed:', validation.error)
            setDebts([])
            safeSetItem('spend_debts', JSON.stringify([]))
          }
        } catch (e) {
          console.error('Failed to parse debts:', e)
          setDebts([])
          safeSetItem('spend_debts', JSON.stringify([]))
        }
      } else {
        setDebts([])
        safeSetItem('spend_debts', JSON.stringify([]))
      }
      setIsInitialized(true)
    }
    initDebts()
  }, [])

  const addDebt = useCallback(async (debt) => {
    const newDebt = {
      ...debt,
      id: crypto.randomUUID ? crypto.randomUUID() : `debt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
    }

    const nextDebts = [newDebt, ...debts]
    setDebts(nextDebts)
    safeSetItem('spend_debts', JSON.stringify(nextDebts))
    return newDebt
  }, [debts])

  const updateDebt = useCallback(async (id, fields) => {
    const nextDebts = debts.map(d => {
      if (d.id === id) {
        return {
          ...d,
          ...fields,
          updatedAt: new Date().toISOString(),
        }
      }
      return d
    })
    setDebts(nextDebts)
    safeSetItem('spend_debts', JSON.stringify(nextDebts))
  }, [debts])

  const deleteDebt = useCallback(async (id) => {
    const nextDebts = debts.filter(d => d.id !== id)
    setDebts(nextDebts)
    safeSetItem('spend_debts', JSON.stringify(nextDebts))
  }, [debts])

  const settleDebt = useCallback(async (id) => {
    await updateDebt(id, { status: 'settled' })
  }, [updateDebt])

  return {
    debts,
    isInitialized,
    addDebt,
    updateDebt,
    deleteDebt,
    settleDebt
  }
}
