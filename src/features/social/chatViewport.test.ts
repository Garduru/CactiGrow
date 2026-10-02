import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

test('mobile chat follows keyboard resize/pan and restores its position on iPhone/Android-sized viewports', async () => {
  const result = await build({ entryPoints: ['src/features/social/useChatViewport.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external' })
  for (const [width, height] of [[390, 844], [360, 800], [412, 915]]) {
    const values = new Map<string, string>()
    const parent = { getBoundingClientRect: () => ({ top: 130, bottom: height - 10 }) }
    const element = { parentElement: parent, style: { setProperty: (key: string, value: string) => values.set(key, value) } }
    const viewport = Object.assign(new EventTarget(), { width, height, offsetTop: 0 })
    const windowMock = Object.assign(new EventTarget(), { visualViewport: viewport, innerHeight: height })
    let cleanup: (() => void) | undefined
    let disconnected = false
    const module = { exports: {} as { useChatViewport: (anchored: boolean) => unknown } }
    const load = new Function('require', 'module', 'exports', 'window', 'ResizeObserver', result.outputFiles[0].text)
    load(() => ({ useRef: () => ({ current: element }), useEffect: (effect: () => () => void) => { cleanup = effect() } }), module, module.exports,
      windowMock, class { observe() {} disconnect() { disconnected = true } })
    module.exports.useChatViewport(true)
    assert.equal(values.get('--chat-keyboard-inset'), '0px')
    viewport.height = height - 340
    viewport.dispatchEvent(new Event('resize'))
    assert.equal(values.get('--chat-keyboard-inset'), '330px')
    assert.equal(values.get('--chat-viewport-height'), `${height - 470}px`)
    viewport.offsetTop = 35
    viewport.dispatchEvent(new Event('scroll'))
    assert.equal(values.get('--chat-keyboard-inset'), '295px')
    viewport.height = height; viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    assert.equal(values.get('--chat-keyboard-inset'), '0px')
    cleanup!()
    assert.equal(disconnected, true)
    viewport.height = 200; viewport.dispatchEvent(new Event('resize'))
    assert.equal(values.get('--chat-keyboard-inset'), '0px', 'unmounted chat no longer listens')
    module.exports.useChatViewport(false)
    assert.equal(values.get('--chat-viewport-height'), '200px', 'modal chat uses the visible viewport height')
    cleanup!()
  }
})
