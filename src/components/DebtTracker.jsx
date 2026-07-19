import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, AlertTriangle, Calendar, Search, ArrowUpRight, ArrowDownLeft, Coins } from 'lucide-react'

export default function DebtTracker({ debts = [], addDebt, updateDebt, deleteDebt, settleDebt, showAlert, categories = [] }) {
  const [activeTab, setActiveTab] = useState('active') // 'active' or 'history'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('loan') // 'loan' = they owe me, 'debt' = I owe them
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  // EMI Setup States
  const [setupEmi, setSetupEmi] = useState(false)
  const [emiAmount, setEmiAmount] = useState('')
  const [emiDay, setEmiDay] = useState('5')
  const [emiCategory, setEmiCategory] = useState('')

  // Edit EMI Modal states
  const [isEmiModalOpen, setIsEmiModalOpen] = useState(false)
  const [selectedDebtForEmi, setSelectedDebtForEmi] = useState(null)
  const [configEmiAmount, setConfigEmiAmount] = useState('')
  const [configEmiDay, setConfigEmiDay] = useState('5')
  const [configEmiCategory, setConfigEmiCategory] = useState('')

  const openConfigureEmiModal = (debt) => {
    setSelectedDebtForEmi(debt)
    setConfigEmiAmount(debt.emiAmount ? String(debt.emiAmount) : '')
    setConfigEmiDay(debt.emiDay ? String(debt.emiDay) : '5')
    setConfigEmiCategory(debt.emiCategory || (outflowCategories.length > 0 ? outflowCategories[0].name : 'Others'))
    setIsEmiModalOpen(true)
  }

  const calculateFirstPaymentDate = (startDateStr, emiDayVal) => {
    const d = new Date(startDateStr)
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
        emiAmount: null,
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

    const parsedEmiDay = parseInt(configEmiDay, 10)
    if (isNaN(parsedEmiDay) || parsedEmiDay < 1 || parsedEmiDay > 31) {
      if (showAlert) showAlert('Please enter a payment day between 1 and 31.', 'warning')
      return
    }

    let nextPaymentDate = selectedDebtForEmi.nextPaymentDate
    if (!nextPaymentDate || selectedDebtForEmi.emiDay !== parsedEmiDay) {
      nextPaymentDate = calculateFirstPaymentDate(selectedDebtForEmi.date, parsedEmiDay)
    }

    await updateDebt(selectedDebtForEmi.id, {
      emiAmount: parsedEmi,
      emiDay: parsedEmiDay,
      emiCategory: configEmiCategory,
      nextPaymentDate
    })

    setIsEmiModalOpen(false)
    if (showAlert) showAlert('EMI schedule updated successfully!', 'success')
  }

  // Filter categories to outflow only
  const outflowCategories = useMemo(() => {
    return categories.filter(c => (c.type || 'outflow') === 'outflow')
  }, [categories])

  // Prefill default category for EMI outflow
  useEffect(() => {
    if (outflowCategories.length > 0 && !emiCategory) {
      setEmiCategory(outflowCategories[0].name)
    }
  }, [outflowCategories, emiCategory])

  // Formula injection sanitation rules
  const sanitizeInput = (val) => {
    if (typeof val !== 'string') return val
    return val.replace(/^[=\+\-@|%]/g, '')
  }

  // Calculate outstanding metrics
  const metrics = useMemo(() => {
    let owedToYou = 0 // People owes you (type = loan, status = pending)
    let youOwe = 0   // You owe people (type = debt, status = pending)

    debts.forEach(d => {
      if (d.status === 'pending') {
        const amt = parseFloat(d.amount) || 0
        if (d.type === 'loan') {
          owedToYou += amt
        } else if (d.type === 'debt') {
          youOwe += amt
        }
      }
    })

    return {
      owedToYou,
      youOwe,
      netBalance: owedToYou - youOwe
    }
  }, [debts])

  // Filter and search debts
  const filteredDebts = useMemo(() => {
    return debts
      .filter(d => {
        const matchesTab = activeTab === 'active' ? d.status === 'pending' : d.status === 'settled'
        const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
        return matchesTab && matchesSearch
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [debts, activeTab, searchQuery])

  // Submit debt/loan handler
  const handleSubmit = (e) => {
    e.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (showAlert) showAlert('Please enter a valid amount greater than 0.', 'warning')
      else alert('Please enter a valid amount greater than 0.')
      return
    }

    if (parsedAmount > 999999999) {
      if (showAlert) showAlert('Amount exceeds the maximum limit.', 'warning')
      else alert('Amount exceeds maximum limit.')
      return
    }

    const cleanName = sanitizeInput(name.trim())
    if (!cleanName) {
      if (showAlert) showAlert('Please enter a person\'s name.', 'warning')
      else alert('Please enter a name.')
      return
    }

    if (cleanName.length > 100) {
      if (showAlert) showAlert('Name must be under 100 characters.', 'warning')
      else alert('Name is too long.')
      return
    }

    const cleanDescription = sanitizeInput(description.trim())
    if (cleanDescription.length > 500) {
      if (showAlert) showAlert('Description must be under 500 characters.', 'warning')
      else alert('Description is too long.')
      return
    }

    // Set up EMI configurations
    let emiProps = {}
    if (setupEmi) {
      const parsedEmi = parseFloat(emiAmount)
      if (isNaN(parsedEmi) || parsedEmi <= 0) {
        if (showAlert) showAlert('Please enter a valid monthly EMI amount.', 'warning')
        else alert('Invalid EMI amount.')
        return
      }

      const parsedEmiDay = parseInt(emiDay, 10)
      if (isNaN(parsedEmiDay) || parsedEmiDay < 1 || parsedEmiDay > 31) {
        if (showAlert) showAlert('Please enter a payment day between 1 and 31.', 'warning')
        else alert('Invalid payment day.')
        return
      }

      emiProps = {
        emiAmount: parsedEmi,
        emiDay: parsedEmiDay,
        emiCategory: emiCategory || (outflowCategories.length > 0 ? outflowCategories[0].name : 'Others')
      }
    }

    addDebt({
      name: cleanName,
      amount: parsedAmount,
      type,
      date,
      dueDate: dueDate || null,
      description: cleanDescription,
      status: 'pending',
      ...emiProps
    })

    if (showAlert) {
      showAlert(`${type === 'loan' ? 'Loan to' : 'Debt from'} ${cleanName} logged successfully!`, 'success')
    }

    // Reset Form
    setName('')
    setAmount('')
    setType('loan')
    setDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setDescription('')
    setSetupEmi(false)
    setEmiAmount('')
    setEmiDay('5')
    if (outflowCategories.length > 0) {
      setEmiCategory(outflowCategories[0].name)
    }
    setIsModalOpen(false)
  }

  const isOverdue = (d) => {
    if (!d.dueDate || d.status === 'settled') return false
    return new Date(d.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* --- DEBT SUMMARY KPIs --- */}
      <section className="metrics-grid">
        
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Owed to You (Loans)</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {formatCurrency(metrics.owedToYou)}
            </span>
            <span className="metric-subtext positive" style={{ color: 'var(--success)' }}>
              <ArrowUpRight size={14} /> Active receivables
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">You Owe (Debts)</span>
            <span className="metric-value" style={{ color: 'var(--warning)' }}>
              {formatCurrency(metrics.youOwe)}
            </span>
            <span className="metric-subtext negative" style={{ color: 'var(--warning)' }}>
              <ArrowDownLeft size={14} /> Active liabilities
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--warning)', borderLeft: '3px solid var(--warning)' }}>
            <ArrowDownLeft size={24} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Net Position</span>
            <span className="metric-value" style={{ color: metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(metrics.netBalance)}
            </span>
            <span className="metric-subtext" style={{ color: metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              <Coins size={14} /> {metrics.netBalance >= 0 ? 'Net positive' : 'Net negative'}
            </span>
          </div>
          <div className="metric-icon-box" style={{ 
            color: metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)', 
            borderLeft: `3px solid ${metrics.netBalance >= 0 ? 'var(--success)' : 'var(--danger)'}` 
          }}>
            <Coins size={24} />
          </div>
        </div>

      </section>

      {/* --- CONTROLS & FILTER ROW --- */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Toggle List Tabs */}
          <div 
            role="group" 
            aria-label="Filter List"
            style={{ 
              display: 'flex', 
              gap: '0.25rem', 
              backgroundColor: 'var(--bg-card-hover)', 
              padding: '0.25rem', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                backgroundColor: activeTab === 'active' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'active' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              Active Obligations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                backgroundColor: activeTab === 'history' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'history' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              Settled History
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Add Entry</span>
          </button>
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

      {/* --- DEBT CARDS RESPONSIVE GRID --- */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1rem',
          width: '100%'
        }}
      >
        {filteredDebts.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Coins size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No {activeTab} debts or loans found matching your query.</p>
          </div>
        ) : (
          filteredDebts.map(d => {
            const overdue = isOverdue(d)
            const original = parseFloat(d.originalAmount) || parseFloat(d.amount) || 0
            const remaining = parseFloat(d.amount) || 0
            const paid = Math.max(0, original - remaining)
            const percent = original > 0 ? Math.round((paid / original) * 100) : 0

            return (
              <div 
                key={d.id} 
                className="transaction-card-item"
                style={{
                  borderLeft: `4px solid ${d.type === 'loan' ? 'var(--success)' : 'var(--warning)'}`,
                  position: 'relative',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tx-card-category" style={{ 
                        backgroundColor: d.type === 'loan' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: d.type === 'loan' ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {d.type === 'loan' ? 'Owed to You' : 'You Owe'}
                      </span>
                      <span className="tx-card-payment" style={{ fontWeight: 600 }}>{d.name}</span>
                      
                      {overdue && (
                        <span className="pending-badge warning" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={12} /> Overdue
                        </span>
                      )}
                    </div>
                    <div className="tx-card-desc" style={{ marginTop: '0.5rem', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {d.description || 'No description provided'}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div className={`tx-card-amount ${d.type === 'loan' ? 'text-success' : 'text-warning'}`} style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      ₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="tx-card-date" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <Calendar size={12} />
                      <span>{d.date}</span>
                    </div>
                    {d.dueDate && (
                      <div className="tx-card-date" style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        Due: {d.dueDate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly EMI Progress Indicators */}
                {d.emiAmount && original > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Paid {formatCurrency(paid)} / {formatCurrency(original)}</span>
                      <span style={{ fontWeight: 600 }}>{percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-card-hover)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: d.type === 'loan' ? 'var(--success)' : 'var(--warning)', borderRadius: '3px', transition: 'width var(--transition-normal)' }}></div>
                    </div>
                    {d.status === 'pending' && d.nextPaymentDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        <Calendar size={12} style={{ color: 'var(--primary)' }} />
                        <span>Next EMI: <strong>{d.nextPaymentDate}</strong> ({formatCurrency(d.emiAmount)}/mo)</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  {d.status === 'pending' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => settleDebt(d.id)}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle2 size={14} className="text-success" />
                      <span>Mark Settled</span>
                    </button>
                  )}
                  {d.status === 'pending' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => openConfigureEmiModal(d)}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Coins size={14} style={{ color: 'var(--primary)' }} />
                      <span>{d.emiAmount ? 'Edit EMI' : 'Set EMI'}</span>
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

      {/* --- ADD MODAL OVERLAY --- */}
      {isModalOpen && (
        <div 
          className="modal-overlay active" 
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setIsModalOpen(false) }}
        >
          <div className="modal-content">
            
            <div className="modal-header">
              <h2>Add Debt / Loan Entry</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              
              {/* Type Selection */}
              <div className="form-group">
                <label>Entry Type</label>
                <div 
                  role="group" 
                  aria-label="Debt Type"
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
                      padding: '0.6rem',
                      border: 'none',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      backgroundColor: type === 'loan' ? 'var(--success)' : 'transparent',
                      color: type === 'loan' ? 'white' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    Owes Me (Loan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('debt')}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: 'none',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      backgroundColor: type === 'debt' ? 'var(--warning)' : 'transparent',
                      color: type === 'debt' ? 'white' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    I Owe (Debt)
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="form-group">
                <label htmlFor="debt-name">Name of Person</label>
                <input 
                  id="debt-name"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Alice Smith, John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
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
                  style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              {/* Date Fields */}
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

              {/* Description */}
              <div className="form-group">
                <label htmlFor="debt-desc">Description / Notes</label>
                <input 
                  id="debt-desc"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Dinner share, borrowed for taxi, rent contribution"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {description.length} / 500 characters
                  </span>
                </div>
              </div>

              {/* Optional EMI Scheduler Setup */}
              <div className="form-group" style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={setupEmi} 
                    onChange={(e) => setSetupEmi(e.target.checked)} 
                    style={{ width: 'auto', transform: 'scale(1.1)', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Enable Automated Monthly EMI</span>
                </label>
              </div>

              {setupEmi && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="debt-emi-amt">Monthly EMI Amount (₹)</label>
                      <input 
                        id="debt-emi-amt"
                        type="number" 
                        step="0.01"
                        className="form-input" 
                        placeholder="0.00"
                        value={emiAmount}
                        onChange={(e) => setEmiAmount(e.target.value)}
                        required={setupEmi}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="debt-emi-day">Payment Day of Month</label>
                      <input 
                        id="debt-emi-day"
                        type="number" 
                        min="1" 
                        max="31"
                        className="form-input" 
                        placeholder="e.g. 5"
                        value={emiDay}
                        onChange={(e) => setEmiDay(e.target.value)}
                        required={setupEmi}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="debt-emi-cat">EMI Outflow Category</label>
                    <select 
                      id="debt-emi-cat"
                      className="form-input"
                      value={emiCategory}
                      onChange={(e) => setEmiCategory(e.target.value)}
                      required={setupEmi}
                    >
                      {outflowCategories.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                </div>
              )}

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

      {/* --- CONFIGURE EMI MODAL OVERLAY --- */}
      {isEmiModalOpen && (
        <div 
          className="modal-overlay active" 
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setIsEmiModalOpen(false) }}
        >
          <div className="modal-content">
            
            <div className="modal-header">
              <h2>Configure Monthly EMI</h2>
              <button className="close-btn" onClick={() => setIsEmiModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleConfigureEmiSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Set up or edit automated monthly payouts for <strong>{selectedDebtForEmi?.name}</strong>. Leaving the EMI amount empty will disable the auto-payment schedule.
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
