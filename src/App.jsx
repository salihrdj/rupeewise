import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  LayoutDashboard, 
  ReceiptText, 
  Settings as SettingsIcon, 
  FolderLock, 
  Plus, 
  Wifi, 
  WifiOff, 
  Moon, 
  Sun, 
  AlertCircle,
  Coins
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import TransactionTable from './components/TransactionTable'
import TransactionForm from './components/TransactionForm'
import Settings from './components/Settings'
import CategoryManager from './components/CategoryManager'
import DebtTracker from './components/DebtTracker'
import ErrorBoundary from './components/ErrorBoundary'
import confetti from 'canvas-confetti'
import { useTransactions } from './hooks/useTransactions'
import { useCategories } from './hooks/useCategories'
import { useDebts } from './hooks/useDebts'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { useSync } from './hooks/useSync'
import { fetchWithTimeout } from './utils/fetchWithTimeout'

// Default categories to seed the application
export const DEFAULT_CATEGORIES = [
  // Outflow (Expenses)
  { name: 'Housing', budget: 25000, color: '#6366f1', type: 'outflow' },   // Indigo
  { name: 'Food', budget: 12000, color: '#ec4899', type: 'outflow' },      // Pink
  { name: 'Utilities', budget: 5000, color: '#06b6d4', type: 'outflow' },    // Cyan
  { name: 'Entertainment', budget: 4000, color: '#f59e0b', type: 'outflow' }, // Amber
  { name: 'Transport', budget: 5000, color: '#10b981', type: 'outflow' },     // Emerald
  { name: 'Healthcare', budget: 3000, color: '#ef4444', type: 'outflow' },    // Red
  { name: 'Shopping', budget: 8000, color: '#a855f7', type: 'outflow' },      // Purple
  { name: 'Others', budget: 3000, color: '#6b7280', type: 'outflow' },         // Gray
  // Inflow (Income)
  { name: 'Salary', budget: 80000, color: '#10b981', type: 'inflow' },      // Emerald
  { name: 'Business', budget: 20000, color: '#059669', type: 'inflow' },    // Dark green
  { name: 'Investments', budget: 10000, color: '#06b6d4', type: 'inflow' }, // Cyan
  { name: 'Gifts', budget: 5000, color: '#f59e0b', type: 'inflow' },        // Amber
  { name: 'Side Hustle', budget: 15000, color: '#a855f7', type: 'inflow' }  // Purple
]

function AppInner() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [alert, setAlert] = useState(null)

  // Helper alert notifier
  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 5000)
  }, [])

  // 1. Settings Context
  const { 
    isN8nMode, 
    setIsN8nMode, 
    n8nUrl, 
    setN8nUrl, 
    n8nToken, 
    setN8nToken, 
    theme, 
    toggleTheme 
  } = useSettings()

  // 2. Transactions & Categories State Hooks
  const {
    transactions,
    setTransactions,
    isInitialized: txsInitialized,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions()

  const {
    categories,
    setCategories,
    isInitialized: catsInitialized,
    updateCategories
  } = useCategories()

  const {
    debts,
    setDebts,
    addDebt,
    deleteDebt,
    settleDebt
  } = useDebts(addTransaction, showAlert)

  const [isSyncing, setIsSyncing] = useState(false)

  // 3. n8n Synchronization Hook
  const {
    fetchFromN8n,
    n8nOfflineRef
  } = useSync({
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
    setIsSyncing
  })

  // Auto-fetch from n8n when n8n mode is enabled or credentials change
  useEffect(() => {
    if (isN8nMode && n8nUrl) {
      fetchFromN8n()
    }
  }, [isN8nMode, n8nUrl, n8nToken, fetchFromN8n])

  // Background silent polling (every 30 seconds)
  useEffect(() => {
    let intervalId
    if (isN8nMode && n8nUrl) {
      intervalId = setInterval(() => {
        fetchFromN8n(true) // Silent background fetch
      }, 30000)
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isN8nMode, n8nUrl, n8nToken, fetchFromN8n])

  // Detect user agent for audit logging
  const getDeviceType = () => {
    const ua = navigator.userAgent
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet'
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'Mobile'
    }
    return 'Desktop'
  }

  // Security: Prevent CSV / Excel Formula Injection
  const sanitizeInput = (text) => {
    if (typeof text !== 'string') return text
    let sanitized = text.trim()
    // Strip leading characters that could trigger Excel formulas
    sanitized = sanitized.replace(/^[\s\t\r\n]*[=+\-@|%]/, '')
    // Escape double quotes for CSV safety
    sanitized = sanitized.replace(/"/g, '""')
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '')
    return sanitized
  }

  // Handle Add/Edit Form submission
  const handleSaveTransaction = async (formData) => {
    const cleanDesc = sanitizeInput(formData.description)
    const cleanCat = sanitizeInput(formData.category)
    const cleanPaymentMethod = sanitizeInput(formData.paymentMethod)
    const cleanStatus = sanitizeInput(formData.status)
    const amountNum = parseFloat(formData.amount)

    // Trigger notifications & confetti based on transaction type
    if (!formData.id) {
      if (formData.type === 'inflow') {
        confetti({
          particleCount: 65,
          spread: 80,
          origin: { y: 0.7 }
        })
      } else if (formData.type === 'outflow') {
        const categoryBudgetObj = categories.find(c => c.name === cleanCat && c.type === 'outflow')
        if (categoryBudgetObj) {
          const currentSpent = transactions
            .filter(t => t.category === cleanCat && t.id !== formData.id && t.type === 'outflow')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0)
          
          if (currentSpent + amountNum > categoryBudgetObj.budget) {
            showAlert(`Warning: Budget for "${cleanCat}" exceeded!`, 'warning')
          } else {
            confetti({
              particleCount: 35,
              spread: 50,
              origin: { y: 0.8 }
            })
          }
        }
      }
    } else if (formData.type === 'outflow') {
      const categoryBudgetObj = categories.find(c => c.name === cleanCat && c.type === 'outflow')
      if (categoryBudgetObj) {
        const currentSpent = transactions
          .filter(t => t.category === cleanCat && t.id !== formData.id && t.type === 'outflow')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        
        if (currentSpent + amountNum > categoryBudgetObj.budget) {
          showAlert(`Warning: Budget for "${cleanCat}" exceeded!`, 'warning')
        }
      }
    }

    if (formData.id) {
      // --- UPDATE TRANSACTION ---
      await updateTransaction(formData.id, {
        ...formData,
        description: cleanDesc,
        category: cleanCat,
        paymentMethod: cleanPaymentMethod,
        status: cleanStatus,
        amount: amountNum
      })
      setIsAddModalOpen(false)
      setEditingTransaction(null)
      showAlert('Transaction updated!')
    } else {
      // --- CREATE NEW TRANSACTION ---
      await addTransaction({
        date: formData.date,
        category: cleanCat,
        amount: amountNum,
        type: formData.type || 'outflow',
        description: cleanDesc,
        paymentMethod: cleanPaymentMethod,
        status: cleanStatus,
        sourceDevice: getDeviceType()
      })
      setIsAddModalOpen(false)
      showAlert('Transaction recorded!')
    }

    // Trigger sync in the background
    if (isN8nMode && n8nUrl && !n8nOfflineRef.current) {
      fetchFromN8n(true)
    }
  }

  const handleDeleteTransaction = async (txId) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(txId)
      showAlert('Transaction deleted.', 'warning')
      
      // Trigger sync in the background
      if (isN8nMode && n8nUrl && !n8nOfflineRef.current) {
        fetchFromN8n(true)
      }
    }
  }

  const handleUpdateCategories = async (updatedCategories, reassignMap) => {
    await updateCategories(updatedCategories)
    
    if (reassignMap) {
      const { oldCategory, newCategory } = reassignMap
      const allTxs = JSON.parse(localStorage.getItem('spend_transactions') || '[]')
      const updatedTxs = allTxs.map(t => {
        if (t.category === oldCategory) {
          return {
            ...t,
            category: newCategory,
            updatedAt: new Date().toISOString(),
            syncPending: t.syncPending === 'add' ? 'add' : 'update',
            version: (t.version || 0) + 1
          }
        }
        return t
      })
      setTransactions(updatedTxs.filter(t => t && t.syncPending !== 'delete'))
      localStorage.setItem('spend_transactions', JSON.stringify(updatedTxs))
      
      if (isN8nMode && n8nUrl && !n8nOfflineRef.current) {
        fetchFromN8n(true)
      }
    }
    
    showAlert('Category budgets updated!')
    
    if (isN8nMode && n8nUrl) {
      try {
        await fetchWithTimeout(n8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': n8nToken
          },
          body: JSON.stringify({
            action: 'update_categories',
            data: updatedCategories
          })
        }, 10000)
      } catch (err) {
        console.error('Failed to sync updated categories to n8n:', err)
      }
    }
  }

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction)
    setIsAddModalOpen(true)
  }

  return (
    <div className="app-container">
      {/* Alert Overlay */}
      {alert && (
        <div className={`alert-banner ${alert.type}`} role="alert" aria-live="polite">
          <AlertCircle size={20} />
          <span>{alert.message}</span>
        </div>
      )}

      {/* --- SIDEBAR FOR PC --- */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">💰</span>
          <span>RupeeWise</span>
        </div>

        <nav className="nav-container">
          <ul className="nav-links">
            <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('dashboard')}>
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('transactions')}>
                <ReceiptText size={20} />
                <span>Expenditures</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('categories')}>
                <FolderLock size={20} />
                <span>Category Budgets</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'debts' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('debts')}>
                <Coins size={20} />
                <span>Debts & Loans</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('settings')}>
                <SettingsIcon size={20} />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="mode-indicator">
            <span>Database Mode</span>
            {isN8nMode ? (
              <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}>
                <Wifi size={16} /> Sync (n8n)
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <WifiOff size={16} /> Offline
              </span>
            )}
          </div>

          <div className="theme-toggle">
            <span>Theme Mode</span>
            <button onClick={toggleTheme} className="theme-btn" aria-label="Toggle visual color theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT WINDOW --- */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-title">
            <h1>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'transactions' && 'Expenditure Journal'}
              {activeTab === 'categories' && 'Budget Guardrails'}
              {activeTab === 'debts' && 'Debts & Loans'}
              {activeTab === 'settings' && 'App Configuration'}
            </h1>
            <p className="subtitle">
              {activeTab === 'dashboard' && 'Visual analysis and summary of your financials.'}
              {activeTab === 'transactions' && 'Full registry of all expenditures.'}
              {activeTab === 'categories' && 'Set custom monthly allowances by category.'}
              {activeTab === 'debts' && 'Track owes, loans, and net debt balances.'}
              {activeTab === 'settings' && 'Configure database storage and sync workflows.'}
            </p>
          </div>

          <div className="header-actions">
            {isSyncing && (
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                🔄 Syncing...
              </span>
            )}
            <button className="btn btn-primary" onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }}>
              <Plus size={18} />
              <span>Log Expenditure</span>
            </button>
          </div>
        </header>

        {/* --- VIEW SWITCHER --- */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            transactions={transactions} 
            categories={categories} 
            debts={debts}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionTable 
            transactions={transactions} 
            categories={categories}
            onEdit={openEditModal} 
            onDelete={handleDeleteTransaction} 
          />
        )}

        {activeTab === 'categories' && (
          <CategoryManager 
            categories={categories} 
            onUpdate={handleUpdateCategories} 
            showAlert={showAlert}
            transactions={transactions}
          />
        )}

        {activeTab === 'debts' && (
          <DebtTracker 
            debts={debts}
            addDebt={addDebt}
            deleteDebt={deleteDebt}
            settleDebt={settleDebt}
            showAlert={showAlert}
            categories={categories}
          />
        )}

        {activeTab === 'settings' && (
          <Settings 
            onSync={() => fetchFromN8n(false)}
            isSyncing={isSyncing}
            transactions={transactions}
            categories={categories}
            setTransactions={setTransactions}
            setCategories={setCategories}
          />
        )}
      </main>

      {/* --- BOTTOM NAVIGATION FOR MOBILE --- */}
      <nav className="bottom-nav">
        <button 
          style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('dashboard')}
          aria-label="Navigate to dashboard"
        >
          <LayoutDashboard size={24} />
        </button>
        <button 
          style={{ background: 'none', border: 'none', color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('transactions')}
          aria-label="Navigate to transactions journal"
        >
          <ReceiptText size={24} />
        </button>
        <button 
          style={{ background: 'none', border: 'none', color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('categories')}
          aria-label="Navigate to categories budget management"
        >
          <FolderLock size={24} />
        </button>
        <button 
          style={{ background: 'none', border: 'none', color: activeTab === 'debts' ? 'var(--primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('debts')}
          aria-label="Navigate to debts tracker"
        >
          <Coins size={24} />
        </button>
        <button 
          style={{ background: 'none', border: 'none', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('settings')}
          aria-label="Navigate to configuration settings"
        >
          <SettingsIcon size={24} />
        </button>
      </nav>

      {/* --- MOBILE FLOATING ACTION BUTTON --- */}
      <button className="mobile-fab" onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }} aria-label="Log a new transaction">
        <Plus size={28} />
      </button>

      {/* --- ADD/EDIT MODAL OVERLAY --- */}
      {isAddModalOpen && (
        <TransactionForm 
          isOpen={isAddModalOpen} 
          onClose={() => { setIsAddModalOpen(false); setEditingTransaction(null); }} 
          onSave={handleSaveTransaction} 
          categories={categories}
          editingTransaction={editingTransaction}
          showAlert={showAlert}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </ErrorBoundary>
  )
}
