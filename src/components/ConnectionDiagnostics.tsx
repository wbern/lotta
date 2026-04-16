import type { DiagnosticEntry, RelaySocketInfo } from '../services/p2p-service'

interface RtcPeerState {
  peerId: string
  state: string
}

interface ConnectionDiagnosticsProps {
  diagInfo: { roomId: string; selfId: string; role: string; strategy?: string; hostId?: string }
  relayStatus: RelaySocketInfo[]
  diagnosticLog: DiagnosticEntry[]
  peerCount?: number
  reconnectAttempts?: number
  rtcPeerStates?: RtcPeerState[]
}

function relayStateLabel(readyState: number): string {
  switch (readyState) {
    case 0:
      return 'Ansluter...'
    case 1:
      return 'Ansluten'
    case 2:
      return 'Stänger...'
    default:
      return 'Frånkopplad'
  }
}

export function ConnectionDiagnostics({
  diagInfo,
  relayStatus,
  diagnosticLog,
  peerCount,
  reconnectAttempts,
  rtcPeerStates,
}: ConnectionDiagnosticsProps) {
  const connectedRelays = relayStatus.filter((r) => r.readyState === 1).length

  return (
    <div className="live-tab-diagnostics">
      <div className="live-diagnostics-section">
        <h4>Anslutning</h4>
        <table className="live-tab-peer-table">
          <tbody>
            <tr>
              <td>Rum-ID</td>
              <td>
                <code>{diagInfo.roomId || '—'}</code>
              </td>
            </tr>
            <tr>
              <td>Self-ID</td>
              <td>
                <code>{diagInfo.selfId || '—'}</code>
              </td>
            </tr>
            {diagInfo.hostId && (
              <tr>
                <td>Host-ID</td>
                <td>
                  <code>{diagInfo.hostId}</code>
                </td>
              </tr>
            )}
            <tr>
              <td>Roll</td>
              <td>{diagInfo.role || '—'}</td>
            </tr>
            {peerCount !== undefined && (
              <tr>
                <td>Peers</td>
                <td>{peerCount}</td>
              </tr>
            )}
            {reconnectAttempts !== undefined && (
              <tr>
                <td>Återanslutningsförsök</td>
                <td>{reconnectAttempts}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="live-diagnostics-section">
        <h4>
          {diagInfo.strategy === 'mqtt' ? 'MQTT-mäklare' : 'NOSTR-reläer'} ({connectedRelays}/
          {relayStatus.length} anslutna)
        </h4>
        {relayStatus.length === 0 ? (
          <p className="live-tab-empty">Inga reläer hittades.</p>
        ) : (
          <table className="live-tab-peer-table">
            <thead>
              <tr>
                <th>Relä</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {relayStatus.map((r) => (
                <tr key={r.url}>
                  <td>
                    <code className="live-tab-url">{r.url}</code>
                  </td>
                  <td>
                    <span
                      className={`live-tab-role ${r.readyState === 1 ? 'live-tab-role--viewer' : 'live-tab-role--referee'}`}
                    >
                      {relayStateLabel(r.readyState)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rtcPeerStates && rtcPeerStates.length > 0 && (
        <div className="live-diagnostics-section">
          <h4>WebRTC-anslutningar</h4>
          <table className="live-tab-peer-table">
            <thead>
              <tr>
                <th>Peer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rtcPeerStates.map((p) => (
                <tr key={p.peerId}>
                  <td>
                    <code>{p.peerId}...</code>
                  </td>
                  <td>{p.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="live-diagnostics-section">
        <h4>Händelselogg</h4>
        {diagnosticLog.length === 0 ? (
          <p className="live-tab-empty">Inga händelser ännu.</p>
        ) : (
          <div className="live-diagnostics-log">
            {[...diagnosticLog].reverse().map((entry, i) => (
              <div key={i} className="live-diagnostics-log-entry">
                <span className="live-diagnostics-time">
                  {new Date(entry.timestamp).toLocaleTimeString('sv-SE')}
                </span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
