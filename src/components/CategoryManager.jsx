import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'

export default function CategoryManager({ categories = [], onUpdate, showAlert, transactions = [] }) {
  // --- STATE FOR FILTER/DISPLAY ---
  const [activeCategoryType, setActiveCategoryType] = useState('outflow')

  // --- STATE FOR ADDING NEW CATEGORY ---
  const [newCatName, setNewCatName] = useState('')
  const [newCatBudget, setNewCatBudget] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [newCatType, setNewCatType] = useState('outflow')

  // --- STATE FOR INLINE EDITS ---
  const [editedBudgets, setEditedBudgets] = useState({})

  // Handle budget edit input changes
  const handleBudgetChange = (catName, val) => {
    setEditedBudgets(prev => ({
      ...prev,
      [catName]: val
    }))
  }

  // Handle color edit changes
  const handleColorChange = (catName, hexColor) => {
    const updated = categories.map(c => 
      c.name === catName ? { ...c, color: hexColor } : c
    )
    onUpdate(updated)
  }

  // Save modified budgets
  const handleSaveBudget = (catName) => {
    const newVal = parseFloat(editedBudgets[catName])
    if (isNaN(newVal) || newVal < 0) {
      if (showAlert) {
        showAlert('Please enter a valid positive number.', 'warning')
      } else {
        alert('Please enter a valid positive number.')
      }
      return
    }

    const updated = categories.map(c => 
      c.name === catName ? { ...c, budget: newVal } : c
    )
    
    // Clear edited state item
    const nextEdited = { ...editedBudgets }
    delete nextEdited[catName]
    setEditedBudgets(nextEdited)

    onUpdate(updated)
  }

  // Add a new custom category
  const handleCreateCategory = (e) => {
    e.preventDefault()

    const name = newCatName.trim()
    const budget = parseFloat(newCatBudget)

    if (!name) {
      if (showAlert) {
        showAlert('Please enter a category name.', 'warning')
      } else {
        alert('Please enter a category name.')
      }
      return
    }
    if (isNaN(budget) || budget <= 0) {
      if (showAlert) {
        showAlert('Please enter a valid positive monthly budget/target amount.', 'warning')
      } else {
        alert('Please enter a valid positive monthly budget/target amount.')
      }
      return
    }

    // Check duplicate
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      if (showAlert) {
        showAlert('This category already exists.', 'warning')
      } else {
        alert('This category already exists.')
      }
      return
    }

    const newCat = {
      name,
      budget,
      color: newCatColor,
      type: newCatType
    }

    onUpdate([...categories, newCat])

    // Reset inputs
    setNewCatName('')
    setNewCatBudget('')
    setNewCatColor('#6366f1')
  }

  // Remove category
  const handleDeleteCategory = (catName) => {
    const affectedCount = (transactions || []).filter(t => t.category === catName).length
    
    if (affectedCount > 0) {
      const choice = window.confirm(
        `The category "${catName}" is used by ${affectedCount} transaction(s).\n\n` +
        `Click [OK] to reassign these transactions to "Others".\n` +
        `Click [Cancel] to keep them orphaned with the category name "${catName}".`
      )
      
      if (choice) {
        const updated = categories.filter(c => c.name !== catName)
        onUpdate(updated, { oldCategory: catName, newCategory: 'Others' })
      } else {
        const updated = categories.filter(c => c.name !== catName)
        onUpdate(updated)
      }
    } else {
      if (window.confirm(`Are you sure you want to delete "${catName}"?`)) {
        const updated = categories.filter(c => c.name !== catName)
        onUpdate(updated)
      }
    }
  }

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  // Filter categories by type and memoize
  const displayedCategories = useMemo(() => {
    return categories.filter(c => (c.type || 'outflow') === activeCategoryType)
  }, [categories, activeCategoryType])

  const totalBudgetLimit = useMemo(() => {
    return displayedCategories.reduce((acc, c) => acc + c.budget, 0)
  }, [displayedCategories])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* --- ADD NEW CATEGORY PANEL --- */}
      <section className="card">
        <h3>Create Custom Category</h3>
        <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.25rem', alignItems: 'flex-end' }}>
          
          {/* Category Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category Type</label>
            <select
              className="form-input"
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value)}
            >
              <option value="outflow">Outflow (Expense)</option>
              <option value="inflow">Inflow (Income)</option>
            </select>
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={newCatType === 'inflow' ? 'e.g. Side Hustle, Rent Yield' : 'e.g. Travel, Gym, Gift'} 
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
          </div>

          {/* Budget / Target */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {newCatType === 'inflow' ? 'Monthly Target Goal (₹)' : 'Monthly Allowance Limit (₹)'}
            </label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="0.00" 
              value={newCatBudget}
              onChange={(e) => setNewCatBudget(e.target.value)}
              required
            />
          </div>

          {/* Color Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Visual Theme Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="color" 
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                aria-label="New category visual color"
                style={{ 
                  width: '44px', 
                  height: '40px', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: 'transparent'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {newCatColor.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
            <Plus size={18} />
            <span>Add Category</span>
          </button>
        </form>
      </section>

      {/* --- CATEGORY LIST & LIMIT EDITORS --- */}
      <section className="card">
        
        {/* Toggle Categories Type list */}
        <div className="chart-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-card-hover)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            <button 
              style={{ 
                background: activeCategoryType === 'outflow' ? 'var(--primary)' : 'none', 
                border: 'none', 
                color: activeCategoryType === 'outflow' ? 'white' : 'var(--text-secondary)',
                padding: '0.4rem 0.8rem',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
              onClick={() => setActiveCategoryType('outflow')}
            >
              Outflow Budgets
            </button>
            <button 
              style={{ 
                background: activeCategoryType === 'inflow' ? 'var(--success)' : 'none', 
                border: 'none', 
                color: activeCategoryType === 'inflow' ? 'white' : 'var(--text-secondary)',
                padding: '0.4rem 0.8rem',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
              onClick={() => setActiveCategoryType('inflow')}
            >
              Inflow Targets
            </button>
          </div>

          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {activeCategoryType === 'outflow' ? 'Total Expenses Cap: ' : 'Total Income Target: '} 
            <span style={{ color: activeCategoryType === 'outflow' ? 'var(--danger)' : 'var(--success)' }}>
              {formatCurrency(totalBudgetLimit)}
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayedCategories.length > 0 ? (
            displayedCategories.map(cat => {
              const isEditing = editedBudgets[cat.name] !== undefined
              const currentEditVal = isEditing ? editedBudgets[cat.name] : cat.budget

              return (
                <div key={cat.name} className="category-item" style={{ borderLeft: `4px solid ${cat.color}` }}>
                  
                  {/* Left side: color box and name */}
                  <div className="category-label-box">
                    {/* Inline Color Picker */}
                    <input 
                      type="color"
                      value={cat.color}
                      onChange={(e) => handleColorChange(cat.name, e.target.value)}
                      title="Change theme color"
                      aria-label={`Change visual color for category ${cat.name}`}
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        border: 'none', 
                        borderRadius: 'var(--radius-sm)', 
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                      }}
                    />
                    <span className="category-name" style={{ fontSize: '1.05rem' }}>{cat.name}</span>
                  </div>

                  {/* Right side: budget controls & delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    
                    {/* Budget input or read-only indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>₹</span>
                      <input 
                        type="number"
                        className="form-input"
                        value={currentEditVal}
                        onChange={(e) => handleBudgetChange(cat.name, e.target.value)}
                        style={{ 
                          width: '100px', 
                          padding: '0.4rem 0.5rem', 
                          textAlign: 'right', 
                          fontSize: '0.95rem',
                          fontWeight: 600
                        }}
                      />
                      
                      {/* Show save button if budget input value changed */}
                      {isEditing && (
                        <button 
                          className="btn btn-secondary btn-icon-only btn-sm"
                          onClick={() => handleSaveBudget(cat.name)}
                          style={{ padding: '0.4rem', color: 'var(--success)', borderColor: 'var(--success-glow)' }}
                          title="Save budget/target limit"
                        >
                          <Save size={16} />
                        </button>
                      )}
                    </div>

                    {/* Delete category */}
                    <button 
                      className="btn btn-danger btn-icon-only btn-sm"
                      onClick={() => handleDeleteCategory(cat.name)}
                      style={{ padding: '0.4rem' }}
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </div>
              )
            })
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No budget categories created for this category type.
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
