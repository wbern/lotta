import { describe, expect, it } from 'vitest'
import { actionErrorMessage, emitSaveError } from './save-error-bus'

describe('actionErrorMessage', () => {
  it('given a validation error, when formatted for a toast, then its message is returned', () => {
    expect(actionErrorMessage(new Error('Klubben används av spelare.'))).toBe(
      'Klubben används av spelare.',
    )
  })

  it('given a non-Error rejection, when formatted for a toast, then it is stringified', () => {
    expect(actionErrorMessage('oops')).toBe('oops')
  })

  it('given an error already announced as a save failure, when formatted for a toast, then null is returned so it is not toasted twice', () => {
    const quotaError = new Error('QuotaExceededError')
    emitSaveError(quotaError)

    expect(actionErrorMessage(quotaError)).toBeNull()
  })
})
