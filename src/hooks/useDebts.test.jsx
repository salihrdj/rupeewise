import { describe, test, expect } from 'vitest'
import { validateDebts } from '../schemas/n8nResponse'

describe('validateDebts', () => {
  test('should validate a normal debt record', () => {
    const data = [
      {
        id: 'debt-1',
        name: 'Alice',
        type: 'loan',
        amount: 5000,
        description: 'Dinner loan',
        date: '2026-07-20',
        dueDate: null,
        status: 'pending'
      }
    ]
    const res = validateDebts(data)
    expect(res.success).toBe(true)
  })

  test('should validate a debt record with emi parameters', () => {
    const data = [
      {
        id: 'debt-2',
        name: 'Bob',
        type: 'debt',
        amount: 25000,
        description: 'Buying laptop',
        date: '2026-07-20',
        dueDate: '2026-12-20',
        status: 'pending',
        originalAmount: 25000,
        emiAmount: 5000,
        emiCategory: 'Others',
        emiDay: 5,
        nextPaymentDate: '2026-08-05',
        lastPaymentDate: null
      }
    ]
    const res = validateDebts(data)
    if (!res.success) {
      console.error(res.error)
    }
    expect(res.success).toBe(true)
  })
})
