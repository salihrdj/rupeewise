import { useState, useCallback, useEffect } from 'react'
import { safeGetItem, safeSetItem, addPendingMutation, getOfflineQueueStatus } from '../utils/storage'
import { validateTransactions } from '../schemas/n8nResponse'

export function useTransactions() {
  const [transactions, setTransactions] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initTransactions = () => {
      const localTxs = safeGetItem('spend_transactions')
      if (localTxs) {
        try {
          const parsedTxs = JSON.parse(localTxs)
          if (Array.isArray(parsedTxs)) {
            const validationResult = validateTransactions(parsedTxs)
            if (validationResult.success) {
              const filteredTxs = validationResult.data.filter(
                t => t && typeof t.id === 'string' && !t.id.startsWith('tx-sample-')
              ).filter(t => t && t.syncPending !== 'delete')
              setTransactions(filteredTxs)
              safeSetItem('spend_transactions', JSON.stringify(validationResult.data))
            } else {
              console.warn('Transaction validation warning, salvaging valid entries:', validationResult.error)
              const salvagedTxs = parsedTxs.filter(
                t => t && typeof t.id === 'string' && typeof t.category === 'string' && !isNaN(parseFloat(t.amount)) && !String(t.id).startsWith('tx-sample-') && t.syncPending !== 'delete'
              )
              setTransactions(salvagedTxs)
            }
          } else {
            setTransactions([])
          }
        } catch (err) {
          console.error('Failed to parse transactions:', err)
          setTransactions([])
        }
      } else {
        setTransactions([])
        safeSetItem('spend_transactions', JSON.stringify([]))
      }
      setIsInitialized(true)
    }
    initTransactions()
  }, [])

  const addTransaction = useCallback(async (tx) => {
    const newTx = {
      ...tx,
      id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncPending: 'add',
      version: 1,
    }

    setTransactions(prevTxs => [newTx, ...prevTxs].filter(t => t && t.syncPending !== 'delete'))
    
    const allTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
    const nextAllTxs = [newTx, ...allTxs]
    safeSetItem('spend_transactions', JSON.stringify(nextAllTxs))
    
    addPendingMutation({ ...newTx, syncPending: undefined })
    
    return newTx
  }, [])

  const updateTransaction = useCallback(async (id, updates) => {
    const allTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
    const existingTx = allTxs.find(t => t.id === id)
    const nextVersion = (existingTx?.version || 0) + 1
    
    const updatedTx = {
      ...updates,
      updatedAt: new Date().toISOString(),
      syncPending: 'update',
      version: nextVersion,
    }

    setTransactions(prevTxs => prevTxs.map(t => t.id === id ? updatedTx : t).filter(t => t && t.syncPending !== 'delete'))
    
    const nextAllTxs = allTxs.map(t => t.id === id ? updatedTx : t)
    safeSetItem('spend_transactions', JSON.stringify(nextAllTxs))
    
    addPendingMutation({ ...updatedTx, syncPending: undefined })
  }, [])

  const deleteTransaction = useCallback(async (id) => {
    const allTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
    const txToDelete = allTxs.find(t => t.id === id)
    if (!txToDelete) return

    if (txToDelete.syncPending === 'add') {
      setTransactions(prevTxs => prevTxs.filter(t => t.id !== id))
      const nextAllTxs = allTxs.filter(t => t.id !== id)
      safeSetItem('spend_transactions', JSON.stringify(nextAllTxs))
      return
    }

    setTransactions(prevTxs => prevTxs.filter(t => t.id !== id))
    const nextAllTxs = allTxs.map(t => t.id === id ? { ...txToDelete, syncPending: 'delete' } : t)
    safeSetItem('spend_transactions', JSON.stringify(nextAllTxs))
    
    addPendingMutation({ ...txToDelete, syncPending: 'delete' })
  }, [])

  const getQueueStatus = useCallback(() => {
    return getOfflineQueueStatus()
  }, [])

  return {
    transactions,
    setTransactions,
    isInitialized,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getQueueStatus,
  }
}