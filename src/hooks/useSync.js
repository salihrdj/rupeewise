import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { acquireLock, releaseLock } from '../utils/syncLock'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { validateN8nFetchResponse, validateN8nMutationResponse } from '../schemas/n8nResponse'
import { DEFAULT_CATEGORIES } from '../App'

export function useSync({
  isN8nMode,
  n8nUrl,
  n8nToken,
  transactions,
  categories,
  debts,
  setTransactions,
  setCategories,
  setDebts,
  showAlert,
  isSyncing,
  setIsSyncing,
}) {
  const n8nOfflineRef = useRef(false)
  const offlineCheckCounterRef = useRef(0)
  const isSyncingRef = useRef(false)

  const saveMutationToN8n = useCallback(async (type, action, data, silentAlert = false, skipLock = false) => {
    if (!isN8nMode || !n8nUrl) return true
    
    if (!skipLock) {
      const lockAcquired = await acquireLock()
      if (!lockAcquired) return false
    }

    // Construct action string compatible with n8n workflow router
    let actionString = action
    if (type === 'debt' && !action.includes('debt')) {
      actionString = `${action}_debt`
    }
    
    try {
      const response = await fetchWithTimeout(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': n8nToken
        },
        body: JSON.stringify({
          action: actionString,
          type,
          data
        })
      }, 15000)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Check your n8n Auth Token/API Key.')
        }
        throw new Error(`Failed to commit change. Server code: ${response.status}`)
      }

      let resData = null
      try {
        resData = await response.json()
      } catch (e) {
        return true
      }

      let targetObj = resData
      if (Array.isArray(resData) && resData.length > 0) {
        targetObj = resData[0]?.json || resData[0] || {}
      }

      if (targetObj && typeof targetObj === 'object') {
        if (targetObj.success === false) {
          throw new Error(targetObj.error || 'n8n execution returned success: false')
        }
        if (targetObj.error && targetObj.success !== true) {
          throw new Error(targetObj.error)
        }
      }

      return true
    } catch (err) {
      console.error(err)
      if (err.name === 'AbortError') {
        if (!silentAlert) {
          showAlert(`n8n ${type} mutation timed out. Kept locally as pending sync.`, 'warning')
        }
      } else {
        if (!silentAlert) {
          showAlert(`n8n Sync Failed: ${err.message}. Saved locally; sync pending.`, 'warning')
        }
      }
      return false
    } finally {
      if (!skipLock) {
        await releaseLock()
      }
    }
  }, [isN8nMode, n8nUrl, n8nToken, showAlert])

  const syncPendingMutations = useCallback(async () => {
    // 1. Sync Transactions
    const localTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
    const pendingTxs = localTxs.filter(t => t && t.syncPending)

    // 2. Sync Debts
    const localDebts = JSON.parse(safeGetItem('spend_debts') || '[]')
    const pendingDebts = localDebts.filter(d => d && d.syncPending)

    let allSuccess = true

    // Process transactions
    if (pendingTxs.length > 0) {
      const nextLocalTxs = [...localTxs]
      let updatedAny = false
      for (const tx of pendingTxs) {
        try {
          const cleanTx = { ...tx }
          delete cleanTx.syncPending
          const success = await saveMutationToN8n('transaction', tx.syncPending, cleanTx, true, true)
          if (success) {
            updatedAny = true
            if (tx.syncPending === 'delete') {
              const index = nextLocalTxs.findIndex(t => t.id === tx.id)
              if (index !== -1) nextLocalTxs.splice(index, 1)
            } else {
              const index = nextLocalTxs.findIndex(t => t.id === tx.id)
              if (index !== -1) nextLocalTxs[index] = cleanTx
            }
          } else {
            allSuccess = false
            break
          }
        } catch (err) {
          console.error(err)
          allSuccess = false
          break
        }
      }
      if (updatedAny) {
        safeSetItem('spend_transactions', JSON.stringify(nextLocalTxs))
        setTransactions(nextLocalTxs.filter(t => t && t.syncPending !== 'delete'))
      }
    }

    // Process debts
    if (allSuccess && pendingDebts.length > 0) {
      const nextLocalDebts = [...localDebts]
      let updatedAny = false
      for (const d of pendingDebts) {
        try {
          const cleanDebt = { ...d }
          delete cleanDebt.syncPending
          const success = await saveMutationToN8n('debt', d.syncPending, cleanDebt, true, true)
          if (success) {
            updatedAny = true
            if (d.syncPending === 'delete') {
              const index = nextLocalDebts.findIndex(x => x.id === d.id)
              if (index !== -1) nextLocalDebts.splice(index, 1)
            } else {
              const index = nextLocalDebts.findIndex(x => x.id === d.id)
              if (index !== -1) nextLocalDebts[index] = cleanDebt
            }
          } else {
            allSuccess = false
            break
          }
        } catch (err) {
          console.error(err)
          allSuccess = false
          break
        }
      }
      if (updatedAny) {
        safeSetItem('spend_debts', JSON.stringify(nextLocalDebts))
        setDebts(nextLocalDebts.filter(x => x && x.syncPending !== 'delete'))
      }
    }

    return allSuccess
  }, [setTransactions, setDebts, saveMutationToN8n])

  const fetchFromN8n = useCallback(async (silent = false) => {
    if (!n8nUrl) return
    
    if (isSyncingRef.current) return
    
    if (silent && n8nOfflineRef.current) {
      offlineCheckCounterRef.current += 1
      if (offlineCheckCounterRef.current % 4 !== 0) {
        return
      }
    }

    const lockAcquired = await acquireLock()
    if (!lockAcquired) return
    
    isSyncingRef.current = true
    if (!silent) setIsSyncing(true)
    try {
      const syncSuccess = await syncPendingMutations()
      if (!syncSuccess) {
        n8nOfflineRef.current = true
        if (!silent) {
          showAlert('Could not sync offline changes (n8n is offline). Working in offline mode.', 'warning')
        }
        return
      }

      n8nOfflineRef.current = false
      offlineCheckCounterRef.current = 0

      const response = await fetchWithTimeout(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': n8nToken
        },
        body: JSON.stringify({ action: 'fetch' })
      }, silent ? 8000 : 90000)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Check your n8n Auth Token/API Key.')
        }
        throw new Error(`Server returned error status ${response.status}`)
      }

      let resData = await response.json()
      
      if (Array.isArray(resData) && resData.length > 0) {
        if (resData[0]?.json && typeof resData[0].json === 'object') {
          resData = resData[0].json
        } else if (resData[0] && typeof resData[0] === 'object' && ('transactions' in resData[0] || 'categories' in resData[0] || 'debts' in resData[0])) {
          resData = resData[0]
        }
      }

      const validationResult = validateN8nFetchResponse(resData)
      if (!validationResult.success) {
        console.warn('n8n fetch response validation warning:', validationResult.error)
      }
      
      const validatedData = validationResult.success ? validationResult.data : (typeof resData === 'object' && resData ? resData : {})
      
      if (validatedData.syncErrors && (validatedData.syncErrors.transactions || validatedData.syncErrors.categories || validatedData.syncErrors.debts)) {
        const failedSheets = []
        if (validatedData.syncErrors.transactions) failedSheets.push('Transactions')
        if (validatedData.syncErrors.categories) failedSheets.push('Categories')
        if (validatedData.syncErrors.debts) failedSheets.push('Debts')
        throw new Error(`Connected to n8n, but Google Sheet read failed for: ${failedSheets.join(', ')}. Check sheet name, column headers, and credentials in n8n.`)
      }
      
      // Merge Transactions
      if (validatedData.transactions) {
        const localTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
        const remoteTxs = validatedData.transactions
        const conflicts = []
        const mergedTxs = []

        for (const remoteTx of remoteTxs) {
          const localTx = localTxs.find(t => t.id === remoteTx.id)
          
          if (!localTx) {
            mergedTxs.push(remoteTx)
          } else if (localTx.syncPending) {
            mergedTxs.push(localTx)
            conflicts.push({ id: remoteTx.id, reason: 'local_pending' })
          } else if (remoteTx.version && localTx.version && remoteTx.version > localTx.version) {
            mergedTxs.push(remoteTx)
            if (remoteTx.version !== localTx.version) {
              conflicts.push({ id: remoteTx.id, reason: 'remote_newer' })
            }
          } else if (remoteTx.version && localTx.version && remoteTx.version < localTx.version) {
            mergedTxs.push(localTx)
            conflicts.push({ id: remoteTx.id, reason: 'local_newer' })
          } else if (remoteTx.version && localTx.version && remoteTx.version === localTx.version) {
            const remoteUpdated = new Date(remoteTx.updatedAt || 0).getTime()
            const localUpdated = new Date(localTx.updatedAt || 0).getTime()
            mergedTxs.push(remoteUpdated > localUpdated ? remoteTx : localTx)
          } else {
            const remoteUpdated = new Date(remoteTx.updatedAt || 0).getTime()
            const localUpdated = new Date(localTx.updatedAt || 0).getTime()
            mergedTxs.push(remoteUpdated > localUpdated ? remoteTx : localTx)
          }
        }

        for (const localTx of localTxs) {
          if (!remoteTxs.find(t => t.id === localTx.id)) {
            mergedTxs.push(localTx)
          }
        }

        const nextTxsStr = JSON.stringify(mergedTxs)
        const currentTxsStr = safeGetItem('spend_transactions')
        if (nextTxsStr !== currentTxsStr) {
          setTransactions(mergedTxs)
          safeSetItem('spend_transactions', nextTxsStr)
        }

        if (conflicts.length > 0 && !silent) {
          showAlert(`Sync conflict resolved for ${conflicts.length} transaction(s). Local changes preserved.`, 'warning')
        }
      }

      // Merge Categories
      if (validatedData.categories) {
        if (validatedData.categories.length > 0) {
          const nextCatsStr = JSON.stringify(validatedData.categories)
          const currentCatsStr = safeGetItem('spend_categories')
          if (nextCatsStr !== currentCatsStr) {
            setCategories(validatedData.categories)
            safeSetItem('spend_categories', nextCatsStr)
          }
        } else {
          const currentCatsStr = safeGetItem('spend_categories')
          if (!currentCatsStr || JSON.parse(currentCatsStr).length === 0) {
            setCategories(DEFAULT_CATEGORIES)
            safeSetItem('spend_categories', JSON.stringify(DEFAULT_CATEGORIES))
          }
        }
      }

      // Merge Debts
      if (validatedData.debts) {
        const localDebts = JSON.parse(safeGetItem('spend_debts') || '[]')
        const remoteDebts = validatedData.debts
        const mergedDebts = []

        for (const remoteDebt of remoteDebts) {
          const localDebt = localDebts.find(d => d.id === remoteDebt.id)
          
          if (!localDebt) {
            mergedDebts.push(remoteDebt)
          } else if (localDebt.syncPending) {
            mergedDebts.push(localDebt)
          } else {
            const remoteUpdated = new Date(remoteDebt.updatedAt || 0).getTime()
            const localUpdated = new Date(localDebt.updatedAt || 0).getTime()
            mergedDebts.push(remoteUpdated > localUpdated ? remoteDebt : localDebt)
          }
        }

        for (const localDebt of localDebts) {
          if (!remoteDebts.find(d => d.id === localDebt.id)) {
            mergedDebts.push(localDebt)
          }
        }

        const nextDebtsStr = JSON.stringify(mergedDebts)
        const currentDebtsStr = safeGetItem('spend_debts')
        if (nextDebtsStr !== currentDebtsStr) {
          setDebts(mergedDebts)
          safeSetItem('spend_debts', nextDebtsStr)
        }
      }

      if (!silent) {
        showAlert('Database successfully synchronized with Sheet database!')
      }
    } catch (err) {
      console.error(err)
      if (err.name === 'AbortError') {
        n8nOfflineRef.current = true
        if (!silent) {
          showAlert('n8n request timed out. Working in offline mode.', 'warning')
        }
      } else {
        n8nOfflineRef.current = true
        if (!silent) {
          showAlert(err.message || 'Failed to sync with n8n. Using offline database.', 'danger')
        }
      }
    } finally {
      isSyncingRef.current = false
      if (!silent) setIsSyncing(false)
      await releaseLock()
    }
  }, [n8nUrl, n8nToken, syncPendingMutations, setTransactions, setCategories, setDebts, showAlert, setIsSyncing])

  return {
    fetchFromN8n,
    saveMutationToN8n,
    syncPendingMutations,
    isSyncingRef,
    n8nOfflineRef,
    offlineCheckCounterRef,
  }
}