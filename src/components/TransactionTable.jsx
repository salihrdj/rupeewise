import React, { useState, useMemo } from 'react'
import { Edit3, Trash2, Search, Calendar, Filter } from 'lucide-react'

// Map category names to aesthetic emoji placeholders
const CATEGORY_EMOJIS = {
  Housing: '🏠',
  Food: '🍔',
  Utilities: '⚡',
  Entertainment: '🎬',
  Transport: '🚗',
  Healthcare: '🏥',
  Shopping: '🛍️',
  Others: '📦',
  Salary: '💼',
  Business: '📈',
  Investments: '🏦',
  Gifts: '🎁',
  'Side Hustle': '💸'
}

export default function TransactionTable({ 
  transactions = [], 
  categories = [], 
  onEdit, 
  onDelete 
}) {
  // --- STATE FOR FILTERS ---
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedPayment, setSelectedPayment] = useState('All')
  const [selectedType, setSelectedType] = useState('All')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Unique list of payment methods present in current transactions
  const paymentMethods = useMemo(() => {
    return ['All', ...new Set(transactions.map(t => t.paymentMethod).filter(Boolean))]
  }, [transactions])

  // --- FILTER LOGIC ---
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!tx) return false
      const desc = tx.description ? String(tx.description) : ''
      const cat = tx.category ? String(tx.category) : ''
      const search = (searchTerm || '').toLowerCase()

      const matchesSearch = desc.toLowerCase().includes(search) || cat.toLowerCase().includes(search)
      const matchesCategory = selectedCategory === 'All' || tx.category === selectedCategory
      const matchesPayment = selectedPayment === 'All' || tx.paymentMethod === selectedPayment
      const matchesType = selectedType === 'All' || (tx.type || 'outflow') === selectedType

      let matchesDate = true
      if (startDate && tx.date) {
        matchesDate = matchesDate && tx.date >= startDate
      }
      if (endDate && tx.date) {
        matchesDate = matchesDate && tx.date <= endDate
      }

      return matchesSearch && matchesCategory && matchesPayment && matchesType && matchesDate
    }).sort((a, b) => {
      const aDate = a.date ? String(a.date) : ''
      const bDate = b.date ? String(b.date) : ''
      const dateCompare = bDate.localeCompare(aDate)
      if (dateCompare !== 0) return dateCompare
      
      const aCreated = a.createdAt ? String(a.createdAt) : ''
      const bCreated = b.createdAt ? String(b.createdAt) : ''
      return bCreated.localeCompare(aCreated)
    })
  }, [transactions, searchTerm, selectedCategory, selectedPayment, selectedType, startDate, endDate])

  // Format currency (Indian locale)
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  // Format date readable
  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' }
    return new Date(dateStr).toLocaleDateString('en-IN', options)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* --- FILTER CONTROL PANEL --- */}
      <div className="filters-bar">
        {/* Search */}
        <div className="search-input-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search descriptions, tags..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type Dropdown */}
        <select 
          className="select-filter"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="inflow">Inflow (Income)</option>
          <option value="outflow">Outflow (Expense)</option>
        </select>

        {/* Category Dropdown */}
        <select 
          className="select-filter"
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Payment Dropdown */}
        <select 
          className="select-filter"
          value={selectedPayment} 
          onChange={(e) => setSelectedPayment(e.target.value)}
        >
          {paymentMethods.map(pm => (
            <option key={pm} value={pm}>{pm === 'All' ? 'All Payments' : pm}</option>
          ))}
        </select>

        {/* Date Ranges */}
        <div className="date-filter-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              title="Start Date"
            />
          </div>
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            title="End Date"
          />
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || selectedCategory !== 'All' || selectedPayment !== 'All' || selectedType !== 'All' || startDate || endDate) && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchTerm('')
              setSelectedCategory('All')
              setSelectedPayment('All')
              setSelectedType('All')
              setStartDate('')
              setEndDate('')
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="table-container">
        {filteredTransactions.length > 0 ? (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => {
                const catInfo = categories.find(c => c.name === tx.category)
                const color = catInfo ? catInfo.color : '#888888'
                const isInflow = tx.type === 'inflow'
                return (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                    <td>
                      <span className={`badge ${isInflow ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                        {tx.type || 'outflow'}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="category-color-indicator" style={{ backgroundColor: color }}></span>
                        {tx.category}
                      </span>
                    </td>
                    <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{tx.description}</td>
                    <td style={{ 
                      fontFamily: 'var(--font-display)', 
                      fontWeight: 700, 
                      color: isInflow ? 'var(--success)' : 'var(--text-primary)' 
                    }}>
                      {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                    <td>{tx.paymentMethod}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        <span className={`badge ${tx.status === 'Cleared' ? 'badge-success' : 'badge-warning'}`}>
                          {tx.status}
                        </span>
                        {tx.syncPending && (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap' }} title="Pending sync with Google Sheets">
                            ⏳ Pending Sync
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary btn-icon-only btn-sm"
                          onClick={() => onEdit(tx)}
                          title="Edit transaction"
                          aria-label={`Edit transaction: ${tx.description}`}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          className="btn btn-danger btn-icon-only btn-sm"
                          onClick={() => onDelete(tx.id)}
                          title="Delete transaction"
                          aria-label={`Delete transaction: ${tx.description}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transaction records match your filters.
          </div>
        )}
      </div>

      {/* --- MOBILE CARDS VIEW --- */}
      <div className="transaction-cards-list">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map(tx => {
            const catInfo = categories.find(c => c.name === tx.category)
            const color = catInfo ? catInfo.color : '#888888'
            const emoji = CATEGORY_EMOJIS[tx.category] || '📦'
            const isInflow = tx.type === 'inflow'

            return (
              <div key={tx.id} className="transaction-card-item">
                <div className="tx-card-left">
                  <div className="tx-category-icon" style={{ backgroundColor: `${color}15`, color: color }}>
                    {emoji}
                  </div>
                  <div className="tx-card-details">
                    <span className="tx-card-desc">{tx.description}</span>
                    <span className="tx-card-meta">
                      <span>{formatDate(tx.date)}</span>
                      <span>•</span>
                      <span>{tx.paymentMethod}</span>
                    </span>
                  </div>
                </div>

                <div className="tx-card-right">
                  <span className="tx-card-amount" style={{ color: isInflow ? 'var(--success)' : 'var(--text-primary)' }}>
                    {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge ${tx.status === 'Cleared' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>
                      {tx.status}
                    </span>
                    {tx.syncPending && (
                      <span className="badge badge-warning" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }} title="Pending sync with Google Sheets">
                        ⏳ Pending Sync
                      </span>
                    )}
                    <button 
                      className="btn btn-secondary btn-icon-only btn-sm"
                      onClick={() => onEdit(tx)}
                      style={{ padding: '0.25rem' }}
                      aria-label={`Edit transaction: ${tx.description}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      className="btn btn-danger btn-icon-only btn-sm"
                      onClick={() => onDelete(tx.id)}
                      style={{ padding: '0.25rem' }}
                      aria-label={`Delete transaction: ${tx.description}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transactions found.
          </div>
        )}
      </div>

    </div>
  )
}
