import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { bindWorldKeyboardFocus, canUseWorldKeyboard } from './worldKeyboardFocus.ts'

test('editable UI owns typing before Phaser capture; held keys reset and canvas focus restores controls', () => {
  const dom = new JSDOM('<canvas tabindex="0"></canvas><input><textarea></textarea><select><option>A</option></select><div contenteditable="true" tabindex="0"><span tabindex="0">Text</span></div><button>UI</button>')
  const document = dom.window.document
  const canvas = document.querySelector('canvas')!
  let resets = 0, gameplay = 0
  const keyboard = { enabled: true, manager: { enabled: true }, resetKeys() { resets++ } }
  const cleanup = bindWorldKeyboardFocus(canvas, keyboard)
  dom.window.addEventListener('keydown', (event) => {
    if (keyboard.manager.enabled) { gameplay++; event.preventDefault() }
  })
  for (const selector of ['input', 'textarea', 'select', '[contenteditable]', '[contenteditable] span', 'button']) {
    const field = document.querySelector<HTMLElement>(selector)!
    field.focus()
    assert.equal(canUseWorldKeyboard(canvas), false, selector)
    for (const key of 'wasd Wally Dominick Garden Guru') {
      const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      field.dispatchEvent(event)
      assert.equal(event.defaultPrevented, false, `${selector}: ${key} remains available to UI`)
    }
    assert.equal(gameplay, 0)
  }
  assert.ok(resets > 0)
  canvas.focus()
  assert.equal(canUseWorldKeyboard(canvas), true)
  canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'w', bubbles: true }))
  assert.equal(gameplay, 1)
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); document.body.append(dialog)
  canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'e', bubbles: true }))
  assert.equal(gameplay, 1, 'modal blocks world shortcuts even if focus is temporarily on canvas')
  dialog.remove(); cleanup(); dom.window.close()
})
