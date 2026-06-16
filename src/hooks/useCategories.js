import { useState, useCallback, useEffect } from 'react'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { validateCategories } from '../schemas/n8nResponse'
import { DEFAULT_CATEGORIES } from '../App'

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initCategories = () => {
      const localCats = safeGetItem('spend_categories')
      if (localCats) {
        try {
          const parsedCats = JSON.parse(localCats)
          const validationResult = validateCategories(parsedCats)
          if (validationResult.success) {
            if (validationResult.data.length === 0) {
              setCategories(DEFAULT_CATEGORIES)
              safeSetItem('spend_categories', JSON.stringify(DEFAULT_CATEGORIES))
            } else {
              const hasInflow = validationResult.data.some(c => c.type === 'inflow')
              if (!hasInflow) {
                const defaultInflows = DEFAULT_CATEGORIES.filter(c => c.type === 'inflow')
                const migratedCats = [...validationResult.data, ...defaultInflows]
                setCategories(migratedCats)
                safeSetItem('spend_categories', JSON.stringify(migratedCats))
              } else {
                setCategories(validationResult.data)
              }
            }
          } else {
            console.error('Category validation failed:', validationResult.error)
            setCategories(DEFAULT_CATEGORIES)
            safeSetItem('spend_categories', JSON.stringify(DEFAULT_CATEGORIES))
          }
        } catch (err) {
          console.error('Failed to parse categories:', err)
          setCategories(DEFAULT_CATEGORIES)
          safeSetItem('spend_categories', JSON.stringify(DEFAULT_CATEGORIES))
        }
      } else {
        setCategories(DEFAULT_CATEGORIES)
        safeSetItem('spend_categories', JSON.stringify(DEFAULT_CATEGORIES))
      }
      setIsInitialized(true)
    }
    initCategories()
  }, [])

  const updateCategories = useCallback(async (updatedCategories) => {
    setCategories(updatedCategories)
    safeSetItem('spend_categories', JSON.stringify(updatedCategories))
  }, [])

  const addCategory = useCallback(async (category) => {
    const newCategory = {
      ...category,
      type: category.type || 'outflow',
    }
    const updated = [...categories, newCategory]
    setCategories(updated)
    safeSetItem('spend_categories', JSON.stringify(updated))
    return newCategory
  }, [categories])

  const deleteCategory = useCallback(async (name) => {
    const updated = categories.filter(c => c.name !== name)
    setCategories(updated)
    safeSetItem('spend_categories', JSON.stringify(updated))
  }, [categories])

  const updateCategoryBudget = useCallback(async (name, budget) => {
    const updated = categories.map(c => c.name === name ? { ...c, budget } : c)
    setCategories(updated)
    safeSetItem('spend_categories', JSON.stringify(updated))
  }, [categories])

  const updateCategoryColor = useCallback(async (name, color) => {
    const updated = categories.map(c => c.name === name ? { ...c, color } : c)
    setCategories(updated)
    safeSetItem('spend_categories', JSON.stringify(updated))
  }, [categories])

  return {
    categories,
    setCategories,
    isInitialized,
    updateCategories,
    addCategory,
    deleteCategory,
    updateCategoryBudget,
    updateCategoryColor,
  }
}