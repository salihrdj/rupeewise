import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, AlertTriangle, Calendar, Search, ArrowUpRight, ArrowDownLeft, Coins, RefreshCw, CreditCard, User } from 'lucide-react'

export default function DebtTracker({ debts = [], addDebt, updateDebt, deleteDebt, settleDebt, payMonthlyEmi, onSync, isSyncing, showAlert, categories = [] }) {
  const [activeTab, setActiveTab] = useState('one-time') // 'one-time', 'emis', 'history'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryMode, setEntryMode] = useState('one-time') // 'one-time' or 'emi'
  const [searchQuery, setSearchQuery] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('loan') // 'loan' = they owe me, 'debt' = I owe them
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  // EMI Setup States for Add Modal
  const [emiAmount, setEmiAmount] = useState('')
  const [monthsRemaining, setMonthsRemaining] = useState('12')
  const [emiDay, setEmiDay] = useState('5')
  const [emiCategory, setEmiCategory] = useState('')

  // Edit EMI Modal states
  const [isEmiModalOpen, setIsEmiModalOpen] = useState(false)
  const [selectedDebtForEmi, setSelectedDebtForEmi] = useState(null)
  const [configEmiAmount, setConfigEmiAmount] = useState('')
  const [configMonthsRemaining, setConfigMonthsRemaining] = useState('')
  const [configEmiDay, setConfigEmiDay] = useState('5')
  const [configEmiCategory, setConfigEmiCategory] = useState('')

  // Filter categories to outflow only
  const outflowCategories = useMemo(() => {
    return (categories || []).filter(c => c && (c.type || 'outflow') === 'outflow')
  }, [categories])

  // Prefill default category for EMI outflow
  useEffect(() => {
    if (outflowCategories.length > 0 && !emiCategory) {
      setEmiCategory(outflowCategories[0].name)
    }
  }, [outflowCategories, emiCategory])

  const openConfigureEmiModal = (debt) => {
    if (!debt) return
    setSelectedDebtForEmi(debt)
    setConfigEmiAmount(debt.emiAmount ? String(debt.emiAmount) : '')
    setConfigMonthsRemaining(debt.monthsRemaining ? String(debt.monthsRemaining) : (debt.emiAmount && debt.amount ? String(Math.ceil(parseFloat(debt.amount) / parseFloat(debt.emiAmount))) : '12'))
    setConfigEmiDay(debt.emiDay ? String(debt.emiDay) : '5')
    const defaultCat = (outflowCategories && outflowCategories.length > 0) ? outflowCategories[0].name : 'Others'
    setConfigEmiCategory(debt.emiCategory || defaultCat)
    setIsEmiModalOpen(true)
  }

  const calculateFirstPaymentDate = (startDateStr, emiDayVal) => {
    const d = new Date(startDateStr || new Date())
    const year = d.getFullYear()
    const month = d.getMonth()
    const sameMonthDate = new Date(year, month, emiDayVal)
    if (sameMonthDate >= d) {
      return sameMonthDate.toISOString().split('T')[0]
    } else {
      const nextMonthDate = new Date(year, month + 1, emiDayVal)
      return nextMonthDate.toISOString().split('T')[0]
    }
  }

  const handleConfigureEmiSubmit = async (e) => {
    e.preventDefault()
    if (!selectedDebtForEmi) return

    if (!configEmiAmount) {
      // Disable EMI
      await updateDebt(selectedDebtForEmi.id, {
        isEmi: false,
        emiAmount: null,
        monthsRemaining: null,
        totalMonths: null,
        emiDay: null,
        emiCategory: null,
        nextPaymentDate: null
      })
      setIsEmiModalOpen(false)
      if (showAlert) showAlert('EMI schedule disabled for this record.', 'info')
      return
    }

    const parsedEmi = parseFloat(configEmiAmount)
    if (isNaN(parsedEmi) || parsedEmi <= 0) {
      if (showAlert) showAlert('Please enter a valid monthly EMI amount.', 'warning')
      return
    }

    const parsedMonths = parseInt(configMonthsRemaining, 10) || 1
    const parsedEmiDay = parseInt(configEmiDay, 10)
    if (isNaN(parsedEmiDay) || parsedEmiDay < 1 || parsedEmiDay > 31) {
      if (showAlert) showAlert('Please enter a payment day between 1 and 31.', 'warning')
      return
    }

    let nextPaymentDate = selectedDebtForEmi.nextPaymentDate
    if (!nextPaymentDate || selectedDebtForEmi.emiDay !== parsedEmiDay) {
      nextPaymentDate = calculateFirstPaymentDate(selectedDebtForEmi.date, parsedEmiDay)
    }

    const nextTotalAmount = parsedEmi * parsedMonths

    await updateDebt(selectedDebtForEmi.id, {
      isEmi: true,
      amount: nextTotalAmount,
      originalAmount: selectedDebtForEmi.originalAmount || nextTotalAmount,
      emiAmount: parsedEmi,
      totalMonths: selectedDebtForEmi.totalMonths || parsedMonths,
      monthsRemaining: parsedMonths,
      emiDay: parsedEmiDay,
      emiCategory: configEmiCategory,
      nextPaymentDate
    })

    setIsEmiModalOpen(false)
    if (showAlert) showAlert('EMI configuration updated successfully!', 'success')
  }

  // Formula injection sanitation rules
  const sanitizeInput = (val) => {
    if (typeof val !== 'string') return val
    return val.replace(/^[=\+\-@|%]/g, '')
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    let owedToYou = 0 // People owes you (one-time loan)
    let youOwe = 0   // You owe people (one-time debt)
    let totalMonthlyEmis = 0

    ;(debts || []).forEach(d => {
      if (d && (d.status || 'pending') === 'pending') {
        const amt = parseFloat(d.amount) || 0
        if (d.isEmi || d.emiAmount) {
          if (d.type === 'debt') {
            totalMonthlyEmis += (parseFloat(d.emiAmount) || 0)
          }
        } else {
          if (d.type === 'loan') {
            owedToYou += amt
          } else if (d.type === 'debt') {
            youOwe += amt
          }
        }
      }
    })

    return {
      owedToYou,
      youOwe,
      totalMonthlyEmis,
      netBalance: owedToYou - youOwe
    }
  }, [debts])

  // Filter debts by tab
  const filteredDebts = useMemo(() => {
    return (debts || [])
      .filter(d => {
        if (!d) return false
        const query = (searchQuery || '').toLowerCase()
        const nameStr = d.name ? String(d.name) : ''
        const descStr = d.description ? String(d.description) : ''
        const matchesSearch = nameStr.toLowerCase().includes(query) || descStr.toLowerCase().includes(query)
        if (!matchesSearch) return false

        const isSettled = d.status === 'settled' || (parseFloat(d.amount) <= 0)
        if (activeTab === 'history') {
          return isSettled
        }

        if (isSettled) return false

        const isEmiEntry = !!(d.isEmi || d.emiAmount)
        if (activeTab === 'emis') {
          return isEmiEntry
        }

        if (activeTab === 'one-time') {
          return !isEmiEntry
        }

        return true
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [debts, activeTab, searchQuery])

  // Submit new entry handler
  const handleSubmit = (e) => {
    e.preventDefault()

    const cleanName = sanitizeInput(name.trim())
    if (!cleanName) {
      if (showAlert) showAlert('Please enter a name or title.', 'warning')
      return
    }

    const cleanDescription = sanitizeInput(description.trim())

    if (entryMode === 'one-time') {
      const parsedAmount = parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        if (showAlert) showAlert('Please enter a valid amount.', 'warning')
        return
      }

      addDebt({
        name: cleanName,
        amount: parsedAmount,
        originalAmount: parsedAmount,
        type,
        date,
        dueDate: dueDate || null,
        description: cleanDescription,
        status: 'pending',
        isEmi: false
      })

      if (showAlert) {
        showAlert(`${type === 'loan' ? 'Loan to' : 'Debt from'} ${cleanName} logged!`, 'success')
      }
    } else {
      // EMI Entry Mode
      const parsedEmi = parseFloat(emiAmount)
      if (isNaN(parsedEmi) || parsedEmi <= 0) {
        if (showAlert) showAlert('Please enter a valid monthly EMI amount.', 'warning')
        return
      }

      const parsedMonths = parseInt(monthsRemaining, 10)
      if (isNaN(parsedMonths) || parsedMonths < 1) {
        if (showAlert) showAlert('Please enter valid months remaining.', 'warning')
        return
      }

      const parsedEmiDay = parseInt(emiDay, 10)
      if (isNaN(parsedEmiDay) || parsedEmiDay < 1 || parsedEmiDay > 31) {
        if (showAlert) showAlert('Please enter a payment day between 1 and 31.', 'warning')
        return
      }

      const calculatedTotal = parsedEmi * parsedMonths
      const nextPayDate = calculateFirstPaymentDate(date, parsedEmiDay)

      addDebt({
        name: cleanName,
        amount: calculatedTotal,
        originalAmount: calculatedTotal,
        type: 'debt',
        isEmi: true,
        emiAmount: parsedEmi,
        totalMonths: parsedMonths,
        monthsRemaining: parsedMonths,
        emiDay: parsedEmiDay,
        emiCategory: emiCategory || (outflowCategories.length > 0 ? outflowCategories[0].name : 'Others'),
        date,
        nextPaymentDate: nextPayDate,
        description: cleanDescription,
        status: 'pending'
      })

      if (showAlert) {
        showAlert(`Monthly EMI for ${cleanName} (${parsedMonths} months) created!`, 'success')
      }
    }

    // Reset Form
    setName('')
    setAmount('')
    setType('loan')
    setDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setDescription('')
    setEmiAmount('')
    setMonthsRemaining('12')
    setEmiDay('5')
    setIsModalOpen(false)
  }

  const isOverdue = (d) => {
    if (!d || !d.dueDate || d.status === 'settled') return false
    const due = new Date(d.dueDate)
    if (isNaN(due.getTime())) return false
    return due < new Date(new Date().setHours(0, 0, 0, 0))
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* --- TOP SUMMARY CARDS --- */}
      <div className="metrics-grid">
        
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Owed to You</span>
            <span className="metric-value text-success">{formatCurrency(metrics.owedToYou)}</span>
            <span className="metric-subtext positive" style={{ color: 'var(--success)' }}>
              <ArrowDownLeft size={14} /> One-time loans to friends/others
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <ArrowDownLeft size={22} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">You Owe (One-Time)</span>
            <span className="metric-value text-warning">{formatCurrency(metrics.youOwe)}</span>
            <span className="metric-subtext negative" style={{ color: 'var(--warning)' }}>
              <ArrowUpRight size={14} /> One-time pending debts
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--warning)', borderLeft: '3px solid var(--warning)' }}>
            <ArrowUpRight size={22} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Monthly EMI Payouts</span>
            <span className="metric-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(metrics.totalMonthlyEmis)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/ mo</span>
            </span>
            <span className="metric-subtext" style={{ color: 'var(--primary)' }}>
              <CreditCard size={14} /> Total active recurring EMIs
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--primary)', borderLeft: '3px solid var(--primary)' }}>
            <CreditCard size={22} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Net Balance</span>
            <span className={`metric-value ${metrics.netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(metrics.netBalance)}
            </span>
            <span className="metric-subtext" style={{ color: 'var(--text-muted)' }}>
              <Coins size={14} /> Owed minus You Owe
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)', borderLeft: `3px solid ${metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
            <Coins size={22} />
          </div>
        </div>

      </div>

      {/* --- TAB CONTROL & SEARCH BAR --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          <div 
            role="tablist"
            style={{ 
              display: 'inline-flex', 
              backgroundColor: 'var(--bg-card)', 
              padding: '0.25rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.25rem'
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'one-time'}
              onClick={() => setActiveTab('one-time')}
              style={{
                padding: '0.55rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                backgroundColor: activeTab === 'one-time' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'one-time' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <User size={16} />
              <span>One-Time Debts & Loans</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'emis'}
              onClick={() => setActiveTab('emis')}
              style={{
                padding: '0.55rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                backgroundColor: activeTab === 'emis' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'emis' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <CreditCard size={16} />
              <span>Monthly EMIs</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.55rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                backgroundColor: activeTab === 'history' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'history' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <CheckCircle2 size={16} />
              <span>Settled History</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {onSync && (
              <button 
                className="btn btn-secondary" 
                onClick={onSync}
                disabled={isSyncing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                title="Sync debts & EMIs between phone and laptop"
              >
                <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}

            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              <span>Add Entry</span>
            </button>
          </div>

        </div>

        <div className="search-input-box" style={{ width: '100%' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name or description..." 
            className="search-input"
            style={{ width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* --- CARDS GRID --- */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1rem',
          width: '100%'
        }}
      >
        {filteredDebts.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Coins size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontSize: '1rem', fontWeight: 500 }}>No entries found in {activeTab === 'one-time' ? 'One-Time Debts & Loans' : activeTab === 'emis' ? 'Monthly EMIs' : 'Settled History'}.</p>
          </div>
        ) : (
          filteredDebts.map(d => {
            const overdue = isOverdue(d)
            const isEmi = !!(d.isEmi || d.emiAmount)
            const original = parseFloat(d.originalAmount) || parseFloat(d.amount) || 0
            const remaining = parseFloat(d.amount) || 0
            const paid = Math.max(0, original - remaining)
            
            const totalM = parseInt(d.totalMonths, 10) || (d.emiAmount ? Math.ceil(original / parseFloat(d.emiAmount)) : 0)
            const remainingM = (d.monthsRemaining !== undefined && d.monthsRemaining !== null) 
              ? parseInt(d.monthsRemaining, 10) 
              : (d.emiAmount ? Math.ceil(remaining / parseFloat(d.emiAmount)) : 0)
            const paidM = Math.max(0, totalM - remainingM)
            const percent = totalM > 0 ? Math.min(100, Math.round((paidM / totalM) * 100)) : (original > 0 ? Math.min(100, Math.round((paid / original) * 100)) : 0)

            return (
              <div 
                key={d.id} 
                className="transaction-card-item"
                style={{
                  borderLeft: `4px solid ${isEmi ? 'var(--primary)' : (d.type === 'loan' ? 'var(--success)' : 'var(--warning)')}`,
                  position: 'relative',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '0.75rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tx-card-category" style={{ 
                        backgroundColor: isEmi ? 'rgba(99, 102, 241, 0.15)' : (d.type === 'loan' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                        color: isEmi ? 'var(--primary)' : (d.type === 'loan' ? 'var(--success)' : 'var(--warning)'),
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem'
                      }}>
                        {isEmi ? 'Monthly EMI' : (d.type === 'loan' ? 'Owed to You' : 'You Owe')}
                      </span>

                      <span className="tx-card-payment" style={{ fontWeight: 700, fontSize: '1rem' }}>{d.name}</span>
                      
                      {overdue && (
                        <span className="pending-badge warning" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={12} /> Overdue
                        </span>
                      )}
                    </div>
                    {d.description && (
                      <div className="tx-card-desc" style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {d.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div className={`tx-card-amount ${isEmi ? '' : (d.type === 'loan' ? 'text-success' : 'text-warning')}`} style={{ fontSize: '1.2rem', fontWeight: 700, color: isEmi ? 'var(--primary)' : undefined }}>
                      {formatCurrency(remaining)}
                    </div>
                    <div className="tx-card-date" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span>{d.date}</span>
                    </div>
                  </div>
                </div>

                {/* --- EMI SPECIFIC DETAILS & PROGRESS --- */}
                {isEmi && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem', backgroundColor: 'var(--bg-card-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Instalment:</span>
                      <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(d.emiAmount)} / month</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Tenure Progress:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {totalM > 0 ? `${remainingM} of ${totalM} months left` : `${remainingM} months left`}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                    </div>

                    {d.status === 'pending' && d.nextPaymentDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        <span>Next Due: <strong>{d.nextPaymentDate}</strong> (Day {d.emiDay || 5})</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Category: {d.emiCategory || 'Others'}</span>
                      </div>
                    )}

                  </div>
                )}

                {/* --- CARD FOOTER ACTIONS --- */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  
                  {d.status === 'pending' && isEmi && (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => payMonthlyEmi && payMonthlyEmi(d.id)}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary)', color: 'white' }}
                      title="Log this month's instalment and advance tenure"
                    >
                      <CheckCircle2 size={14} />
                      <span>Clear This Month ({formatCurrency(d.emiAmount)})</span>
                    </button>
                  )}

                  {d.status === 'pending' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => settleDebt(d.id)}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle2 size={14} className="text-success" />
                      <span>{isEmi ? 'Settle Entire Loan' : 'Mark Settled'}</span>
                    </button>
                  )}

                  {d.status === 'pending' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => openConfigureEmiModal(d)}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Edit EMI & Tenure"
                    >
                      <Coins size={14} style={{ color: 'var(--primary)' }} />
                      <span>{isEmi ? 'Edit EMI' : 'Set EMI'}</span>
                    </button>
                  )}

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (window.confirm('Delete this record permanently?')) {
                        deleteDebt(d.id)
                      }
                    }}
                    style={{ padding: '0.35rem', minWidth: '32px', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>

                </div>

              </div>
            )
          })
        )}
      </div>

      {/* --- ADD ENTRY MODAL --- */}
      {isModalOpen && (
        <div 
          className="modal-overlay active" 
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setIsModalOpen(false) }}
        >
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="modal-header">
              <h2>Add Entry</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {/* Entry Mode Switch */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Category Type</label>
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  backgroundColor: 'var(--bg-card-hover)', 
                  padding: '0.25rem', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)' 
                }}
              >
                <button
                  type="button"
                  onClick={() => setEntryMode('one-time')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    borderRadius: 'calc(var(--radius-md) - 2px)',
                    backgroundColor: entryMode === 'one-time' ? 'var(--primary)' : 'transparent',
                    color: entryMode === 'one-time' ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  🤝 One-Time Debt / Loan
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('emi')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    borderRadius: 'calc(var(--radius-md) - 2px)',
                    backgroundColor: entryMode === 'emi' ? 'var(--primary)' : 'transparent',
                    color: entryMode === 'emi' ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  💳 Monthly EMI Loan
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Name / Title */}
              <div className="form-group">
                <label htmlFor="debt-name">{entryMode === 'one-time' ? "Name of Person" : "Loan Title / Item Name"}</label>
                <input 
                  id="debt-name"
                  type="text" 
                  className="form-input" 
                  placeholder={entryMode === 'one-time' ? "e.g. Alice Smith, John Doe" : "e.g. Car Loan, iPhone 15 EMI"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              {entryMode === 'one-time' ? (
                <>
                  {/* Type Selection */}
                  <div className="form-group">
                    <label>Entry Direction</label>
                    <div 
                      style={{ 
                        display: 'flex', 
                        gap: '0.5rem', 
                        backgroundColor: 'var(--bg-card-hover)', 
                        padding: '0.25rem', 
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)' 
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setType('loan')}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: 'none',
                          borderRadius: 'calc(var(--radius-md) - 2px)',
                          backgroundColor: type === 'loan' ? 'var(--success)' : 'transparent',
                          color: type === 'loan' ? 'white' : 'var(--text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Owes Me (Loan)
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('debt')}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: 'none',
                          borderRadius: 'calc(var(--radius-md) - 2px)',
                          backgroundColor: type === 'debt' ? 'var(--warning)' : 'transparent',
                          color: type === 'debt' ? 'white' : 'var(--text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        I Owe (Debt)
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="form-group">
                    <label htmlFor="debt-amount">Amount (₹)</label>
                    <input 
                      id="debt-amount"
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  {/* Dates */}
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="debt-date">Date Logged</label>
                      <input 
                        id="debt-date"
                        type="date" 
                        className="form-input" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="debt-due">Due Date (Optional)</label>
                      <input 
                        id="debt-due"
                        type="date" 
                        className="form-input" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* EMI Specific Inputs */}
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emi-amt">Monthly EMI Amount (₹)</label>
                      <input 
                        id="emi-amt"
                        type="number" 
                        step="0.01"
                        className="form-input" 
                        placeholder="e.g. 5000"
                        value={emiAmount}
                        onChange={(e) => setEmiAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="emi-months">Months Remaining / Tenure</label>
                      <input 
                        id="emi-months"
                        type="number" 
                        min="1"
                        className="form-input" 
                        placeholder="e.g. 12"
                        value={monthsRemaining}
                        onChange={(e) => setMonthsRemaining(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emi-day">Payment Day of Month</label>
                      <input 
                        id="emi-day"
                        type="number" 
                        min="1" 
                        max="31"
                        className="form-input" 
                        placeholder="e.g. 5"
                        value={emiDay}
                        onChange={(e) => setEmiDay(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="emi-cat">Outflow Category</label>
                      <select 
                        id="emi-cat"
                        className="form-input"
                        value={emiCategory}
                        onChange={(e) => setEmiCategory(e.target.value)}
                        required
                      >
                        {outflowCategories.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Auto Calculated Loan Balance Preview */}
                  {parseFloat(emiAmount) > 0 && parseInt(monthsRemaining, 10) > 0 && (
                    <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                      Total Balance to Pay: {formatCurrency(parseFloat(emiAmount) * parseInt(monthsRemaining, 10))} ({monthsRemaining} instalments of {formatCurrency(emiAmount)})
                    </div>
                  )}
                </>
              )}

              {/* Description */}
              <div className="form-group">
                <label htmlFor="debt-desc">Description / Notes</label>
                <textarea 
                  id="debt-desc"
                  className="form-input" 
                  rows="2"
                  placeholder="e.g. Dinner share, loan for car purchase, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Entry
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* --- EDIT / CONFIGURE EMI MODAL --- */}
      {isEmiModalOpen && (
        <div 
          className="modal-overlay active" 
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setIsEmiModalOpen(false) }}
        >
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="modal-header">
              <h2>Configure Monthly EMI</h2>
              <button className="close-btn" onClick={() => setIsEmiModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleConfigureEmiSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Configure or update monthly EMI parameters for <strong>{selectedDebtForEmi?.name}</strong>. Leaving the EMI amount empty will disable the EMI schedule.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="config-emi-amt">Monthly EMI Amount (₹)</label>
                  <input 
                    id="config-emi-amt"
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    placeholder="e.g. 5000"
                    value={configEmiAmount}
                    onChange={(e) => setConfigEmiAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="config-months-rem">Months Remaining / Tenure</label>
                  <input 
                    id="config-months-rem"
                    type="number" 
                    min="1"
                    className="form-input" 
                    placeholder="e.g. 12"
                    value={configMonthsRemaining}
                    onChange={(e) => setConfigMonthsRemaining(e.target.value)}
                    required={!!configEmiAmount}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="config-emi-day">Payment Day of Month</label>
                  <input 
                    id="config-emi-day"
                    type="number" 
                    min="1" 
                    max="31"
                    className="form-input" 
                    placeholder="e.g. 5"
                    value={configEmiDay}
                    onChange={(e) => setConfigEmiDay(e.target.value)}
                    required={!!configEmiAmount}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="config-emi-cat">EMI Outflow Category</label>
                  <select 
                    id="config-emi-cat"
                    className="form-input"
                    value={configEmiCategory}
                    onChange={(e) => setConfigEmiCategory(e.target.value)}
                    required={!!configEmiAmount}
                  >
                    {outflowCategories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEmiModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save EMI Configuration
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}
