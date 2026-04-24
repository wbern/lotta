interface Props {
  testIdPrefix: string
  groupByClass: boolean
  onGroupByClassChange: (value: boolean) => void
  compact: boolean
  onCompactChange: (value: boolean) => void
  hideOppLast: boolean
  onHideOppLastChange: (value: boolean) => void
}

export function AlphabeticalOptionsCheckboxes({
  testIdPrefix,
  groupByClass,
  onGroupByClassChange,
  compact,
  onCompactChange,
  hideOppLast,
  onHideOppLastChange,
}: Props) {
  return (
    <div
      className="form-group"
      style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          data-testid={`${testIdPrefix}-group-by-class`}
          checked={groupByClass}
          onChange={(e) => onGroupByClassChange(e.target.checked)}
        />
        Gruppera per klubb på egen sida
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          data-testid={`${testIdPrefix}-compact`}
          checked={compact}
          onChange={(e) => onCompactChange(e.target.checked)}
        />
        Kompakt vy
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          data-testid={`${testIdPrefix}-hide-opp-last`}
          checked={hideOppLast}
          onChange={(e) => onHideOppLastChange(e.target.checked)}
        />
        Dölj motståndares efternamn
      </label>
    </div>
  )
}
