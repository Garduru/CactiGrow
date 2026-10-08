import assert from 'node:assert/strict'

/** Actual creator geometry; this helper does not save or change appearance. */
export async function verifyCreatorViewport(page, { safeArea = { top: 0, right: 0, bottom: 0, left: 0 } } = {}) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('.appearance-setup'), viewport = window.visualViewport
    return shell && Math.abs(shell.getBoundingClientRect().height - (viewport?.height ?? innerHeight)) < 1
  })
  const measure = () => page.evaluate(() => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
    const shell = document.querySelector('.appearance-setup'), controls = document.querySelector('.appearance-setup__controls')
    const style = getComputedStyle(shell), viewport = window.visualViewport
    return {
      viewport: { x: viewport?.offsetLeft ?? 0, y: viewport?.offsetTop ?? 0, width: viewport?.width ?? innerWidth, height: viewport?.height ?? innerHeight },
      shell: box(shell), header: box(shell.querySelector('header')), preview: box(shell.querySelector('.character-preview')), controls: box(controls), actions: box(shell.querySelector('.appearance-setup__actions')),
      padding: { top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft) },
      touchAction: style.touchAction,
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, x: scrollX, y: scrollY, overflow: getComputedStyle(document.documentElement).overflow, bodyOverflow: getComputedStyle(document.body).overflow },
      controlsScroll: { top: controls.scrollTop, height: controls.scrollHeight, clientHeight: controls.clientHeight, overflow: getComputedStyle(controls).overflowY },
      tapHeights: [...shell.querySelectorAll('.appearance-choice,.appearance-setup__actions button')].map(button => button.getBoundingClientRect().height),
      tapWidths: [...shell.querySelectorAll('.appearance-choice,.appearance-setup__actions button')].map(button => button.getBoundingClientRect().width),
    }
  })
  const before = await measure(), v = before.viewport, s = before.shell
  for (const [actual, expected] of [[s.x,v.x],[s.y,v.y],[s.width,v.width],[s.height,v.height]]) assert.ok(Math.abs(actual-expected)<1, 'creator fills the current visual viewport')
  assert.ok(before.document.width <= before.document.clientWidth, 'document has no horizontal overflow')
  assert.ok(before.document.height <= before.document.clientHeight, 'document has no vertical overflow')
  assert.equal(before.document.overflow, 'hidden'); assert.equal(before.document.bodyOverflow, 'hidden')
  assert.equal(before.touchAction,'pan-y','creator permits vertical control scrolling without pinch zoom')
  assert.equal(before.document.y, 0, 'only customization controls scroll')
  for (const edge of ['top','right','bottom','left']) assert.ok(before.padding[edge] >= safeArea[edge], `${edge} safe area is respected`)
  assert.ok(before.header.y >= s.y+safeArea.top && before.actions.bottom <= s.bottom-safeArea.bottom+1, `title and actions stay clear of unsafe edges: ${JSON.stringify({header:before.header,actions:before.actions,shell:s,padding:before.padding,safeArea})}`)
  assert.ok(before.preview.x >= s.x+safeArea.left && before.preview.right <= s.right-safeArea.right+1, 'preview fits safe width')
  assert.ok(before.preview.y >= before.header.bottom && before.preview.bottom <= (before.preview.right <= before.controls.x+1 ? s.bottom-safeArea.bottom : before.controls.y)+1, 'preview stays outside customization scrolling')
  assert.ok(before.preview.height >= Math.min(170,v.height*.28), 'mobile preview remains prominent')
  assert.ok(before.controls.height > 45, `controls retain usable scrolling space: ${JSON.stringify(before)}`)
  assert.ok(before.actions.bottom <= s.bottom+1 && before.actions.y >= before.controls.bottom-1, 'actions remain visible below controls')
  assert.ok(before.tapHeights.every(height => height >= 48), 'choice and action tap targets are at least 48px tall')
  assert.ok(before.tapWidths.every(width => width >= 44), 'choice and action tap targets have usable width')
  assert.equal(before.controlsScroll.overflow, 'auto')
  await page.locator('.appearance-setup__controls').evaluate(element => { element.scrollTop = element.scrollHeight })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  const scrolled = await measure()
  assert.deepEqual(scrolled.preview,before.preview,'preview stays fixed while controls scroll')
  assert.deepEqual(scrolled.actions,before.actions,'bottom actions stay fixed while controls scroll')
  assert.equal(scrolled.document.y,0)
  if (before.controlsScroll.height > before.controlsScroll.clientHeight) assert.ok(scrolled.controlsScroll.top > 0,'overflow stays inside customization controls')
  await page.locator('.appearance-setup__controls').evaluate(element => { element.scrollTop = 0 })
  return { ...before, internalScroll: scrolled.controlsScroll.top > 0 }
}
