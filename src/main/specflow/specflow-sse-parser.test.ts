import { describe, expect, it } from 'vitest'
import { createSseFrameParser } from './specflow-sse-parser'

describe('createSseFrameParser', () => {
  it('parses the server task_event and ping frames', () => {
    const parse = createSseFrameParser()
    const frames = parse(
      'event:task_event\ndata:{"action":"status_changed","task_id":"t1","status":"IN_PROGRESS"}\n\nevent:ping\ndata:{"t":1}\n\n'
    )
    expect(frames).toEqual([
      {
        event: 'task_event',
        data: '{"action":"status_changed","task_id":"t1","status":"IN_PROGRESS"}'
      },
      { event: 'ping', data: '{"t":1}' }
    ])
  })

  it('buffers frames split across chunks, including a split CRLF', () => {
    const parse = createSseFrameParser()
    expect(parse('event: task_ev')).toEqual([])
    expect(parse('ent\r')).toEqual([])
    expect(parse('\ndata: {"a"')).toEqual([])
    expect(parse(':1}\r\n\r')).toEqual([])
    expect(parse('\n')).toEqual([{ event: 'task_event', data: '{"a":1}' }])
  })

  it('joins multi-line data, ignores comments, defaults the event name', () => {
    const parse = createSseFrameParser()
    expect(parse(': keepalive\ndata: one\ndata:two\nid: 7\n\n')).toEqual([
      { event: 'message', data: 'one\ntwo' }
    ])
  })

  it('drops frames without data and resets the event name after dispatch', () => {
    const parse = createSseFrameParser()
    expect(parse('event: lonely\n\ndata: x\n\n')).toEqual([{ event: 'message', data: 'x' }])
  })
})
