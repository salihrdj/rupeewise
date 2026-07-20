import { z } from 'zod'

// Coerce to number — Google Sheets returns numbers as strings
const posNum = () => z.coerce.number().positive()
const nonNegNum = () => z.coerce.number().nonnegative()
const intNonNeg = () => z.coerce.number().int().nonnegative()

const optionalNullableString = () => z.string().optional().nullable()

const emiDaySchema = () => z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
  z.number().int().min(1).max(31).optional().nullable()
)

export const TransactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  category: z.string().min(1),
  amount: posNum(),
  type: z.enum(['inflow', 'outflow']).optional().nullable(),
  description: optionalNullableString(),
  paymentMethod: optionalNullableString(),
  status: z.enum(['Cleared', 'Pending']).optional().nullable(),
  createdAt: optionalNullableString(),
  updatedAt: optionalNullableString(),
  sourceDevice: optionalNullableString(),
  syncPending: z.enum(['add', 'update', 'delete']).optional().nullable(),
  version: intNonNeg().optional().nullable(),
})

export const CategorySchema = z.object({
  name: z.string().min(1),
  budget: nonNegNum(),
  color: z.string().optional().nullable(),
  type: z.enum(['inflow', 'outflow']).optional().nullable(),
})

export const DebtSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['debt', 'loan']),
  amount: nonNegNum(),
  description: optionalNullableString(),
  date: z.string().min(1),
  dueDate: optionalNullableString(),
  status: z.enum(['pending', 'settled']),
  createdAt: optionalNullableString(),
  updatedAt: optionalNullableString(),
  syncPending: z.enum(['add', 'update', 'delete']).optional().nullable(),
  
  // EMI Scheduling Attributes
  originalAmount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nonnegative().optional().nullable()
  ),
  emiAmount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nonnegative().optional().nullable()
  ),
  emiCategory: optionalNullableString(),
  emiDay: emiDaySchema(),
  nextPaymentDate: optionalNullableString(),
  lastPaymentDate: optionalNullableString(),
})

export const SyncErrorsSchema = z.object({
  transactions: z.boolean().optional(),
  categories: z.boolean().optional(),
  debts: z.boolean().optional(),
})

export const N8nFetchResponseSchema = z.object({
  transactions: z.array(TransactionSchema).optional(),
  categories: z.array(CategorySchema).optional(),
  debts: z.array(DebtSchema).optional(),
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

export function validateDebts(data) {
  return z.array(DebtSchema).safeParse(data)
}