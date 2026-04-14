import { describe, expect, it, vi } from 'vitest'
import type { ResultType } from '../types/api'
import { handleSetResult } from './result-command'

describe('handleSetResult', () => {
  it('applies result when board has no existing result', async () => {
    const getCurrentResult = async () => 'NO_RESULT' as ResultType
    const applyResult = async () => {}

    const outcome = await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 1,
        resultType: 'WHITE_WIN',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult, applyResult },
    )

    expect(outcome).toEqual({ status: 'applied' })
  })

  it('returns idempotent when the same result is already set', async () => {
    const getCurrentResult = async () => 'WHITE_WIN' as ResultType
    const applyResult = async () => {}

    const outcome = await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 1,
        resultType: 'WHITE_WIN',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult, applyResult },
    )

    expect(outcome).toEqual({ status: 'idempotent' })
  })

  it('returns conflict when a different result exists and expectedPrior mismatches', async () => {
    const getCurrentResult = async () => 'BLACK_WIN' as ResultType
    const applyResult = async () => {}

    const outcome = await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 1,
        resultType: 'WHITE_WIN',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult, applyResult },
    )

    expect(outcome).toEqual({ status: 'conflict', current: 'BLACK_WIN' })
  })

  it('calls applyResult on applied and skips it on idempotent and conflict', async () => {
    const applyResult = vi.fn()

    // Applied case
    await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 2,
        resultType: 'DRAW',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult: async () => 'NO_RESULT' as ResultType, applyResult },
    )
    expect(applyResult).toHaveBeenCalledWith(1, 1, 2, 'DRAW')

    applyResult.mockClear()

    // Idempotent case
    await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 2,
        resultType: 'DRAW',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult: async () => 'DRAW' as ResultType, applyResult },
    )
    expect(applyResult).not.toHaveBeenCalled()

    // Conflict case
    await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 2,
        resultType: 'WHITE_WIN',
        expectedPrior: 'NO_RESULT',
      },
      { getCurrentResult: async () => 'BLACK_WIN' as ResultType, applyResult },
    )
    expect(applyResult).not.toHaveBeenCalled()
  })

  it('applies when expectedPrior matches current even if current is not NO_RESULT', async () => {
    const applyResult = vi.fn()

    const outcome = await handleSetResult(
      {
        tournamentId: 1,
        roundNr: 1,
        boardNr: 1,
        resultType: 'DRAW',
        expectedPrior: 'WHITE_WIN',
      },
      { getCurrentResult: async () => 'WHITE_WIN' as ResultType, applyResult },
    )

    expect(outcome).toEqual({ status: 'applied' })
    expect(applyResult).toHaveBeenCalledWith(1, 1, 1, 'DRAW')
  })
})

describe('createCommandDeps', () => {
  it('reads current result from provider round data', async () => {
    const { createCommandDeps } = await import('./result-command')
    const mockProvider = {
      rounds: {
        get: vi.fn().mockResolvedValue({
          roundNr: 1,
          hasAllResults: false,
          gameCount: 2,
          games: [
            { boardNr: 1, resultType: 'WHITE_WIN' },
            { boardNr: 2, resultType: 'NO_RESULT' },
          ],
        }),
      },
      results: {
        set: vi.fn().mockResolvedValue({ boardNr: 1, resultType: 'DRAW' }),
      },
    }

    const deps = createCommandDeps(mockProvider as never)
    const result = await deps.getCurrentResult(1, 1, 2)

    expect(result).toBe('NO_RESULT')
    expect(mockProvider.rounds.get).toHaveBeenCalledWith(1, 1)
  })

  it('delegates applyResult to provider results.set', async () => {
    const { createCommandDeps } = await import('./result-command')
    const mockProvider = {
      rounds: {
        get: vi.fn().mockResolvedValue({
          roundNr: 1,
          hasAllResults: false,
          gameCount: 1,
          games: [{ boardNr: 1, resultType: 'NO_RESULT' }],
        }),
      },
      results: {
        set: vi.fn().mockResolvedValue({ boardNr: 1, resultType: 'WHITE_WIN' }),
      },
    }

    const deps = createCommandDeps(mockProvider as never)
    await deps.applyResult(1, 1, 1, 'WHITE_WIN')

    expect(mockProvider.results.set).toHaveBeenCalledWith(1, 1, 1, { resultType: 'WHITE_WIN' })
  })
})
