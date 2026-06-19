import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { acquireLock, releaseLock } from '../utils/syncLock'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { validateN8nFetchResponse } from '../schemas/n8nResponse'
import { DEFAULT_CATEGORIES } from '../App'

export function useSync({
  isN8nMode,
  n8nUrl,
  n8nToken,
  transactions,
  categories,
  setTransactions,
  setCategories,
  showAlert,
  isSyncing,
  setIsSyncing,
}) {
  const n8nOfflineRef = useRef(false)
  const offlineCheckCounterRef = useRef(0)
  const isSyncingRef = useRef(false)

  const saveMutationToN8n = useCallback(async (action, transactionData, silentAlert = false, skipLock = false) => {
    if (!isN8nMode || !n8nUrl) return true
    
    if (!skipLock) {
      const lockAcquired = await acquireLock()
      if (!lockAcquired) return false
    }
    
    try {
      const response = await fetchWithTimeout(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': n8nToken
        },
        body: JSON.stringify({
          action,
          data: transactionData
        })
      }, 90000)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Check your n8n Auth Token/API Key.')
        }
        throw new Error(`Failed to commit change. Server code: ${response.status}`)
      }
      return true
    } catch (err) {
      console.error(err)
      if (err.name === 'AbortError') {
        if (!silentAlert) {
          showAlert('n8n mutation request timed out. Kept locally as pending sync.', 'warning')
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
    const localTxs = JSON.parse(safeGetItem('spend_transactions') || '[]')
    const pendingTxs = localTxs.filter(t => t && t.syncPending)
    if (pendingTxs.length === 0) return true

    let allSuccess = true
    const nextLocalTxs = [...localTxs]
    let updatedAny = false

    for (const tx of pendingTxs) {
      try {
        let success = false
        const cleanTx = { ...tx }
        delete cleanTx.syncPending

        if (tx.syncPending === 'add') {
          success = await saveMutationToN8n('add', cleanTx, true, true)
        } else if (tx.syncPending === 'update') {
          success = await saveMutationToN8n('update', cleanTx, true, true)
        } else if (tx.syncPending === 'delete') {
          success = await saveMutationToN8n('delete', cleanTx, true, true)
        }

        if (success) {
          updatedAny = true
          if (tx.syncPending === 'delete') {
            const index = nextLocalTxs.findIndex(t => t.id === tx.id)
            if (index !== -1) nextLocalTxs.splice(index, 1)
          } else {
            const index = nextLocalTxs.findIndex(t => t.id === tx.id)
            if (index !== -1) {
              nextLocalTxs[index] = cleanTx
            }
          }
        } else {
          allSuccess = false
          break
        }
      } catch (err) {
        console.error('Failed to sync pending transaction:', err)
        allSuccess = false
        break
      }
    }

    if (updatedAny) {
      safeSetItem('spend_transactions', JSON.stringify(nextLocalTxs))
      setTransactions(nextLocalTxs.filter(t => t && t.syncPending !== 'delete'))
    }

    return allSuccess
  }, [setTransactions, saveMutationToN8n])

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

      const resData = await response.json()
      
      const validationResult = validateN8nFetchResponse(resData)
      if (!validationResult.success) {
        console.error('n8n response validation failed:', validationResult.error)
        throw new Error('Invalid response format from n8n. Data may be corrupted.')
      }
      
      const validatedData = validationResult.data
      
      if (validatedData.syncErrors && (validatedData.syncErrors.transactions || validatedData.syncErrors.categories)) {
        const failedSheets = []
        if (validatedData.syncErrors.transactions) failedSheets.push('Transactions')
        if (validatedData.syncErrors.categories) failedSheets.push('Categories')
        throw new Error(`Connected to n8n, but Google Sheet read failed for: ${failedSheets.join(', ')}. Check sheet name, column headers, and credentials in n8n.`)
      }
      
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
            // Self-healing: if a transaction is local but missing from the spreadsheet,
            // and has no pending sync flag, mark it as pending 'add' so it gets uploaded.
            if (!localTx.syncPending) {
              localTx.syncPending = 'add';
              updatedAny = true;
            }
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
  }, [n8nUrl, n8nToken, syncPendingMutations, setTransactions, setCategories, showAlert, setIsSyncing])

  return {
    fetchFromN8n,
    saveMutationToN8n,
    syncPendingMutations,
    isSyncingRef,
    n8nOfflineRef,
    offlineCheckCounterRef,
  }
}