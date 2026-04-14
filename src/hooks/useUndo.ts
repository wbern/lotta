import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import * as undoApi from '../api/undo'
import type { AuditEntry, UndoState } from '../db/undo-manager'
import { getUndoManager } from '../db/undo-provider'

function subscribeToUndo(callback: () => void): () => void {
  return getUndoManager().subscribe(callback)
}

function getUndoState(): UndoState {
  return getUndoManager().getState()
}

function getUndoTimeline(): AuditEntry[] {
  return getUndoManager().getTimeline()
}

function getCurrentSnapshotIndex(): number {
  return getUndoManager().getCurrentSnapshotIndex()
}

export function useUndoState(): UndoState {
  return useSyncExternalStore(subscribeToUndo, getUndoState)
}

export function useUndoActions() {
  const qc = useQueryClient()

  const undoMutation = useMutation({
    mutationFn: () => undoApi.undo(),
    onSuccess: (success) => {
      if (success) qc.invalidateQueries()
    },
  })

  const redoMutation = useMutation({
    mutationFn: () => undoApi.redo(),
    onSuccess: (success) => {
      if (success) qc.invalidateQueries()
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (snapshotIndex: number) => undoApi.restoreToPoint(snapshotIndex),
    onSuccess: (success) => {
      if (success) qc.invalidateQueries()
    },
  })

  const performUndo = useCallback(() => undoMutation.mutateAsync(), [undoMutation])
  const performRedo = useCallback(() => redoMutation.mutateAsync(), [redoMutation])
  const restoreToPoint = useCallback(
    (snapshotIndex: number) => restoreMutation.mutateAsync(snapshotIndex),
    [restoreMutation],
  )

  return { performUndo, performRedo, restoreToPoint }
}

export function useTimeline() {
  const timeline = useSyncExternalStore(subscribeToUndo, getUndoTimeline)
  const currentSnapshotIndex = useSyncExternalStore(subscribeToUndo, getCurrentSnapshotIndex)
  return { timeline, currentSnapshotIndex }
}
