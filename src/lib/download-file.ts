/**
 * Save a blob as a file via a temporary download link.
 *
 * Browsers give no signal when the user cancels an OS "Save as" dialog, so
 * callers cannot tell a saved file from a cancelled one; the "Fil sparad"
 * toast is shown once the download has been handed to the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
