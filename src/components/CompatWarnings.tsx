import { getCompatWarnings } from '../lib/device-compat'

export function CompatWarnings() {
  const warnings = getCompatWarnings()

  if (warnings.length === 0) return null

  return (
    <>
      {warnings.map((w) => (
        <div key={w.id} role="alert" className={`compat-warning compat-warning--${w.severity}`}>
          <strong>{w.message}</strong> {w.suggestion}
        </div>
      ))}
    </>
  )
}
