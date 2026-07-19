import { useState, useCallback, useEffect, useRef } from 'react'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { validateDebts } from '../schemas/n8nResponse'

function getFirstPaymentDate(startDateStr, emiDay) {
  const d = new Date(startDateStr)
  const year = d.getFullYear()
  const month = d.getMonth()
  
  // Try same month first
  const sameMonthDate = new Date(year, month, emiDay)
  if (sameMonthDate >= d) {
    return sameMonthDate.toISOString().split('T')[0]
  } else {
    // If already passed, go to next month
    const nextMonthDate = new Date(year, month + 1, emiDay)
    return nextMonthDate.toISOString().split('T')[0]
  }
}

function advanceOneMonth(dateStr, emiDay) {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth()
  
  // Add 1 month
  const nextDate = new Date(year, month + 1, emiDay)
  return nextDate.toISOString().split('T')[0]
}

export function useDebts(addTransaction, showAlert) {
  const [debts, setDebts] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)
  const hasRunRef = useRef(false)

  useEffect(() => {
    const initDebts = async () => {
      if (hasRunRef.current) return
      hasRunRef.current = true
      
      const localDebts = safeGetItem('spend_debts')
      let loadedDebts = []
      
      if (localDebts) {
        try {
          const parsed = JSON.parse(localDebts)
          const validation = validateDebts(parsed)
          if (validation.success) {
            loadedDebts = validation.data.filter(d => d && d.syncPending !== 'delete')
          } else {
            console.error('Debts validation failed:', validation.error)
            safeSetItem('spend_debts', JSON.stringify([]))
          }
        } catch (e) {
          console.error('Failed to parse debts:', e)
          safeSetItem('spend_debts', JSON.stringify([]))
        }
      }

      // Run Catch-up scheduler on loaded debts
      if (loadedDebts.length > 0) {
        const nowStr = new Date().toISOString().split('T')[0]
        const today = new Date(nowStr)
        let hasUpdates = false
        const updatedDebts = [...loadedDebts]
        
        for (let i = 0; i < updatedDebts.length; i++) {
          const d = updatedDebts[i]
          if (d.status === 'pending' && d.emiAmount && d.nextPaymentDate) {
            let currentDebtAmount = parseFloat(d.amount) || 0
            let currentNextPaymentDateStr = d.nextPaymentDate
            let nextPaymentDate = new Date(currentNextPaymentDateStr)
            let lastPaymentDate = d.lastPaymentDate || ''
            let iterations = 0
            
            while (today >= nextPaymentDate && currentDebtAmount > 0 && iterations < 360) {
              const emiVal = parseFloat(d.emiAmount)
              const paidAmt = Math.min(currentDebtAmount, emiVal)
              
              // Auto-log transaction in Expenditures Journal
              if (addTransaction) {
                await addTransaction({
                  date: currentNextPaymentDateStr,
                  category: d.emiCategory || 'Others',
                  amount: paidAmt,
                  type: 'outflow',
                  description: `EMI Auto-Payment — ${d.name}`
                })
              }
              
              currentDebtAmount -= paidAmt
              lastPaymentDate = currentNextPaymentDateStr
              currentNextPaymentDateStr = advanceOneMonth(currentNextPaymentDateStr, d.emiDay)
              nextPaymentDate = new Date(currentNextPaymentDateStr)
              hasUpdates = true
              iterations++
              
              if (showAlert) {
                showAlert(`Auto-logged monthly EMI of ₹${paidAmt.toLocaleString('en-IN')} for ${d.name}`, 'success')
              }
            }
            
            if (hasUpdates) {
              updatedDebts[i] = {
                ...d,
                amount: currentDebtAmount,
                nextPaymentDate: currentNextPaymentDateStr,
                lastPaymentDate,
                status: currentDebtAmount <= 0 ? 'settled' : 'pending',
                updatedAt: new Date().toISOString()
              }
            }
          }
        }
        
        if (hasUpdates) {
          safeSetItem('spend_debts', JSON.stringify(updatedDebts))
          setDebts(updatedDebts)
        } else {
          setDebts(loadedDebts)
        }
      } else {
        setDebts([])
      }
      
      setIsInitialized(true)
    }
    
    // Only run catch-up loop once addTransaction is ready
    if (addTransaction) {
      initDebts()
    }
  }, [addTransaction])

  const addDebt = useCallback(async (debt) => {
    let nextPaymentDate = null
    if (debt.emiAmount && debt.emiDay) {
      nextPaymentDate = getFirstPaymentDate(debt.date, debt.emiDay)
    }

    const newDebt = {
      ...debt,
      id: crypto.randomUUID ? crypto.randomUUID() : `debt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalAmount: debt.amount,
      nextPaymentDate,
      lastPaymentDate: null,
      status: 'pending',
      syncPending: 'add',
    }

    setDebts(prevDebts => [newDebt, ...prevDebts].filter(d => d && d.syncPending !== 'delete'))
    
    const allDebts = JSON.parse(safeGetItem('spend_debts') || '[]')
    const nextAllDebts = [newDebt, ...allDebts]
    safeSetItem('spend_debts', JSON.stringify(nextAllDebts))
    
    return newDebt
  }, [])

  const updateDebt = useCallback(async (id, fields) => {
    const allDebts = JSON.parse(safeGetItem('spend_debts') || '[]')
    const existingDebt = allDebts.find(d => d.id === id)
    if (!existingDebt) return

    const updatedDebt = {
      ...existingDebt,
      ...fields,
      updatedAt: new Date().toISOString(),
      syncPending: 'update',
    }

    setDebts(prevDebts => prevDebts.map(d => d.id === id ? updatedDebt : d).filter(d => d && d.syncPending !== 'delete'))
    
    const nextAllDebts = allDebts.map(d => d.id === id ? updatedDebt : d)
    safeSetItem('spend_debts', JSON.stringify(nextAllDebts))
  }, [])

  const deleteDebt = useCallback(async (id) => {
    const allDebts = JSON.parse(safeGetItem('spend_debts') || '[]')
    const debtToDelete = allDebts.find(d => d.id === id)
    if (!debtToDelete) return

    if (debtToDelete.syncPending === 'add') {
      setDebts(prevDebts => prevDebts.filter(d => d.id !== id))
      const nextAllDebts = allDebts.filter(d => d.id !== id)
      safeSetItem('spend_debts', JSON.stringify(nextAllDebts))
      return
    }

    setDebts(prevDebts => prevDebts.filter(d => d.id !== id))
    const nextAllDebts = allDebts.map(d => d.id === id ? { ...debtToDelete, syncPending: 'delete' } : d)
    safeSetItem('spend_debts', JSON.stringify(nextAllDebts))
  }, [])

  const settleDebt = useCallback(async (id) => {
    await updateDebt(id, { status: 'settled' })
  }, [updateDebt])

  return {
    debts,
    setDebts,
    isInitialized,
    addDebt,
    updateDebt,
    deleteDebt,
    settleDebt
  }
}
