// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './download-file'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('downloadBlob', () => {
  it('given a blob and a filename, when downloaded, then an anchor with that filename is clicked and the object URL released', () => {
    const blob = new Blob(['x'])
    const createObjectURL = vi.fn(() => 'blob:lotta/1')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    let clicked: HTMLAnchorElement | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = this
    })

    downloadBlob(blob, 'vt-stallning-rond-2.html')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked?.download).toBe('vt-stallning-rond-2.html')
    expect(clicked?.href).toBe('blob:lotta/1')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lotta/1')
  })
})
