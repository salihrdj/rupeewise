import React, { useState, useMemo } from 'react'
import { Plus, Trash2, CheckCircle2, AlertTriangle, Calendar, Search, ArrowUpRight, ArrowDownLeft, Coins } from 'lucide-react'

export default function DebtTracker({ debts = [], addDebt, deleteDebt, settleDebt, showAlert }) {
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

    addDebt({
      name: cleanName,
      amount: parsedAmount,
      type,
      date,
      dueDate: dueDate || null,
      description: cleanDescription,
      status: 'pending'
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
                      ₹{parseFloat(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

    </div>
  )
}
