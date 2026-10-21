export type SseFrame = { event: string; data: string }

/**
 * Incremental `text/event-stream` parser (WHATWG rules: `field:value`, one optional
 * leading space, multi-line `data`, blank line dispatches, `:` comments ignored).
 */
export function createSseFrameParser(): (chunk: string) => SseFrame[] {
  let buffer = ''
  let event = ''
  let dataLines: string[] = []

  return (chunk) => {
    buffer += chunk
    const frames: SseFrame[] = []
    let newline = buffer.search(/\r\n|\r|\n/)
    while (newline !== -1) {
      // Why: a trailing lone `\r` may be the first half of `\r\n`; wait for the next chunk.
      if (buffer[newline] === '\r' && newline === buffer.length - 1) {
        break
      }
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + (buffer.startsWith('\r\n', newline) ? 2 : 1))
      if (line === '') {
        if (dataLines.length > 0) {
          frames.push({ event: event || 'message', data: dataLines.join('\n') })
        }
        event = ''
        dataLines = []
      } else if (!line.startsWith(':')) {
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        let value = colon === -1 ? '' : line.slice(colon + 1)
        if (value.startsWith(' ')) {
          value = value.slice(1)
        }
        if (field === 'event') {
          event = value
        } else if (field === 'data') {
          dataLines.push(value)
        }
      }
      newline = buffer.search(/\r\n|\r|\n/)
    }
    return frames
  }
}
