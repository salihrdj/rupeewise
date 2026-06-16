import { z } from 'zod'

// Coerce to number — Google Sheets returns numbers as strings
const posNum = () => z.coerce.number().positive()
const nonNegNum = () => z.coerce.number().nonnegative()
const intNonNeg = () => z.coerce.number().int().nonnegative()

export const TransactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1),
  amount: posNum(),
  type: z.enum(['inflow', 'outflow']).optional(),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(['Cleared', 'Pending']).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sourceDevice: z.string().optional(),
  syncPending: z.enum(['add', 'update', 'delete']).optional(),
  version: intNonNeg().optional(),
})

export const CategorySchema = z.object({
  name: z.string().min(1),
  budget: nonNegNum(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  type: z.enum(['inflow', 'outflow']).optional(),
})

export const SyncErrorsSchema = z.object({
  transactions: z.boolean().optional(),
  categories: z.boolean().optional(),
})

export const N8nFetchResponseSchema = z.object({
  transactions: z.array(TransactionSchema).optional(),
  categories: z.array(CategorySchema).optional(),
  syncErrors: SyncErrorsSchema.optional(),
})

export const N8nMutationResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
})

export function validateN8nFetchResponse(data) {
  return N8nFetchResponseSchema.safeParse(data)
}

export function validateN8nMutationResponse(data) {
  return N8nMutationResponseSchema.safeParse(data)
}

export function validateTransactions(data) {
  return z.array(TransactionSchema).safeParse(data)
}

export function validateCategories(data) {
  return z.array(CategorySchema).safeParse(data)
}