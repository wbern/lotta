import { useEffect } from 'react'
import { subscribeSaveError } from '../lib/save-error-bus'
import { sv } from '../lib/swedish-text'
import { useToast } from './toast/useToast'

/**
 * The single UI surface for write failures (ADR-0001). Subscribes to the
 * save-error bus and shows one toast whenever any persistence write rejects.
 * A stable id coalesces a burst of failures into a single toast instead of
 * spamming the stack. Renders nothing.
 */
export function SaveErrorToaster() {
  const { show } = useToast()
  useEffect(() => {
    return subscribeSaveError(() => {
      show({
        id: 'save-error',
        message: sv.common.saveFailed,
        variant: 'error',
        autoDismissMs: 8000,
      })
    })
  }, [show])
  return null
}
