import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function TransactionForm({ 
  isOpen, 
  onClose, 
  onSave, 
  categories = [], 
  editingTransaction = null,
  showAlert
}) {
  // --- STATE FOR FORM FIELDS ---
  const [type, setType] = useState('outflow')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Credit Card')
  const [status, setStatus] = useState('Cleared')

  const modalRef = useRef(null)

  // Integrate custom focus trap hook for modal accessibility
  useFocusTrap(modalRef, isOpen, onClose)

  // Prefill fields if editing
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type || 'outflow')
      setDate(editingTransaction.date)
      setCategory(editingTransaction.category)
      setDescription(editingTransaction.description)
      setAmount(editingTransaction.amount.toString())
      setPaymentMethod(editingTransaction.paymentMethod)
      setStatus(editingTransaction.status)
    } else {
      // Default values for new transaction
      setType('outflow')
      setDate(new Date().toISOString().split('T')[0])
      setDescription('')
      setAmount('')
      setPaymentMethod('Credit Card')
      setStatus('Cleared')
      
      const filtered = categories.filter(c => (c.type || 'outflow') === 'outflow')
      setCategory(filtered.length > 0 ? filtered[0].name : '')
    }
  }, [editingTransaction, categories, isOpen])

  // Dynamically update the selected category when the transaction type changes
  useEffect(() => {
    const filtered = categories.filter(c => (c.type || 'outflow') === type)
    if (filtered.length > 0) {
      if (!filtered.some(c => c.name === category)) {
        setCategory(filtered[0].name)
      }
    } else {
      setCategory('')
    }
  }, [type, categories])

  // Filtered categories based on selected transaction type and memoized
  const filteredCategories = useMemo(() => {
    return categories.filter(c => (c.type || 'outflow') === type)
  }, [categories, type])

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      if (showAlert) {
        showAlert('Please enter a valid amount greater than 0.', 'warning')
      } else {
        alert('Please enter a valid amount greater than 0.')
      }
      return
    }
    if (!description.trim()) {
      if (showAlert) {
        showAlert('Please enter a brief description.', 'warning')
      } else {
        alert('Please enter a brief description.')
      }
      return
    }
    if (!category) {
      if (showAlert) {
        showAlert('Please select a category.', 'warning')
      } else {
        alert('Please select a category.')
      }
      return
    }

    onSave({
      id: editingTransaction ? editingTransaction.id : undefined,
      date,
      category,
      description: description.trim(),
      amount: parseFloat(amount),
      type,
      paymentMethod,
      status
    })
  }

  // Handle click on background to close
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      onClose()
    }
  }

  return (
    <div 
      className={`modal-overlay ${isOpen ? 'active' : ''}`} 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="modal-content">
        
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title">{editingTransaction ? 'Modify Entry' : 'Log Transaction'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          
          {/* Segmented Type Control (Inflow vs Outflow) */}
          <div className="form-group">
            <label>Transaction Type</label>
            <div 
              role="group" 
              aria-label="Transaction Type Selection"
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
                onClick={() => setType('outflow')}
                aria-pressed={type === 'outflow'}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  backgroundColor: type === 'outflow' ? 'var(--primary)' : 'transparent',
                  color: type === 'outflow' ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Outflow (Expense)
              </button>
              <button
                type="button"
                onClick={() => setType('inflow')}
                aria-pressed={type === 'inflow'}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  backgroundColor: type === 'inflow' ? 'var(--success)' : 'transparent',
                  color: type === 'inflow' ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Inflow (Income)
              </button>
            </div>
          </div>

          {/* Amount field (First for prominence) */}
          <div className="form-group">
            <label htmlFor="tx-amount">Amount (₹)</label>
            <input 
              id="tx-amount"
              type="number" 
              step="0.01" 
              className="form-input" 
              placeholder="0.00"
              style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="tx-desc">Description</label>
            <input 
              id="tx-desc"
              type="text" 
              className="form-input" 
              placeholder={type === 'inflow' ? 'e.g. Salary, Client Payout, Dividends' : 'e.g. Weekly Groceries, Gas, Dinner'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {description.length} / 500 characters
              </span>
            </div>
          </div>

          <div className="form-row">
            {/* Category Dropdown (Filtered) */}
            <div className="form-group">
              <label htmlFor="tx-cat">Category</label>
              <select 
                id="tx-cat"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {filteredCategories.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="form-group">
              <label htmlFor="tx-date">Date</label>
              <input 
                id="tx-date"
                type="date" 
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            {/* Payment Method */}
            <div className="form-group">
              <label htmlFor="tx-payment">Payment Method</label>
              <select 
                id="tx-payment"
                className="form-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI / QR Scan</option>
              </select>
            </div>

            {/* Status */}
            <div className="form-group">
              <label htmlFor="tx-status">Status</label>
              <select 
                id="tx-status"
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Cleared">Cleared</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTransaction ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
