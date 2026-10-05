import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('compact HUD and separate feature panels retain Farm/Town hosts, session and presence', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test/play', pretendToBeVisual: true })
  const original = new Map<string, PropertyDescriptor | undefined>()
  function install(key: string, value: unknown) { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }) }
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent']) install(key, dom.window[key as keyof typeof dom.window])
  install('IS_REACT_ACT_ENVIRONMENT', true)
  install('ResizeObserver', class { observe() {} disconnect() {} })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.scrollTo = () => {}
  dom.window.matchMedia = () => ({ matches: false }) as MediaQueryList
  const records = { worlds: [] as { emitIntent: (intent: { type: string; locationId: string }) => void; world: string; x: number; y: number; destroyed: boolean; destroy(): void }[], starts: 0, stops: 0, bootstrap: 0, social: 0, signouts: 0, snapshots: 0 }
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { async writeText(value: string) { assert.equal(JSON.parse(value).panel, 'devtools'); records.snapshots++ } } })
  install('navigator', dom.window.navigator)
  install('menuTestRecords', records)
  const own = { publicId: '00000000-0000-4000-8000-000000000001', displayName: 'Test Alpha', joinedAt: '2026-01-01', collectionCount: 0, breedingCount: 0, cultivationXp: 388, cultivationLevel: 5, skills: [{id:'cultivation',name:'Cultivation',level:5},{id:'breeding',name:'Breeding',level:3},{id:'genetics',name:'Genetics',level:2}], totalLevel: 10 }
  const friend = { ...own, publicId: '00000000-0000-4000-8000-000000000002', displayName: 'Test Bravo' }
  const incoming = { ...friend, publicId: '00000000-0000-4000-8000-000000000003', displayName: 'Test Charlie' }
  const overview = { projectionVersion: 1, ownProfile: own, friends: [friend], incomingRequests: [incoming], outgoingRequests: [] as (typeof own)[], blockedPlayers: [] }
  let failSocial = false
  install('fetch', async (url: string, init?: RequestInit) => {
    let data: unknown
    if (url.endsWith('/bootstrap')) { records.bootstrap++; data = { projectionVersion: 1, player: { playerId: own.publicId, createdAt: '2026-01-01T00:00:00.000Z' } } }
    else if (url.endsWith('/social')) {
      records.social++
      if (failSocial) return new Response(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Refresh unavailable' }, meta: { requestId: 'test' } }), { status: 500 })
      if (init?.method === 'POST' && JSON.parse(String(init.body)).type === 'add-friend') overview.outgoingRequests = [{...friend, publicId:'00000000-0000-4000-8000-000000000004',displayName:'Test Delta'}]
      if (init?.method === 'POST' && JSON.parse(String(init.body)).type === 'remove-friend') overview.friends = []
      if (init?.method === 'POST' && JSON.parse(String(init.body)).type === 'accept-friend') { overview.friends.push(incoming); overview.incomingRequests = [] }
      data = overview
    } else if (url.endsWith('/shop')) data = { projectionVersion: 1, maxQuantity: 100, items: [{ id: 'san-pedro-seed', speciesId: 'echinopsis-pachanoi', name: 'San Pedro seeds', description: 'Normal species seeds.', price: 25 }] }
    else if (url.endsWith('/mail/count')) data = {unreadCount:2}
    else if (url.includes('/mail?')) data = {projectionVersion:1,unreadCount:2,inbox:[],sent:[],hasMoreInbox:false,hasMoreSent:false}
    else if (url.endsWith('/dev/session')) data = { environment: 'development', version: 'test-build', playerId: own.publicId }
    else if (url.includes('/marketplace?')) data = { projectionVersion: 1, hasMore: false, listings: [] }
    else if (url.includes('/players/search?q=')) data = {projectionVersion:1,results:[{projectionVersion:1,profile:{...friend,publicId:'00000000-0000-4000-8000-000000000004',displayName:'Test Delta'},relationship:{isSelf:false,areFriends:false,request:overview.outgoingRequests.length?'outgoing':null,blockedByMe:false,blocksMe:false}}]}
    else if (url.includes('/players/')) data = { projectionVersion: 1, profile: friend, relationship: { isSelf: false, areFriends: true, request: null, blockedByMe: false, blocksMe: false } }
    else throw new Error(`Unexpected test request: ${url}`)
    return new Response(JSON.stringify({ ok: true, data, meta: { requestId: 'test' } }))
  })
  await mkdir(resolve('node_modules/.tmp'), { recursive: true })
  const file = resolve('node_modules/.tmp', `menu-test-${crypto.randomUUID()}.mjs`)
  t.after(async () => { await unlink(file); dom.window.close(); for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } })
  const built = await build({ stdin: { contents: `
    import React,{act} from 'react'; import {createRoot} from 'react-dom/client';
    import {MemoryRouter,useLocation} from 'react-router-dom'; import {AppRoutes} from './src/app/AppRouter';
    function Location(){return <output id="test-path">{useLocation().pathname}</output>}
    export {act}; export function mount(path){const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={[path]}><Location/><AppRoutes/></MemoryRouter>);return root;}
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ MODE: 'development', DEV: false }) },
    plugins: [{ name: 'world-runtime-fixtures', setup(plugin) {
      plugin.onResolve({ filter: /\/create(Farm|Town)WorldGame$/ }, (args) => ({ path: args.path.includes('Farm') ? 'Farm' : 'Town', namespace: 'world-test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'world-test' }, (args) => ({ contents: `export function create${args.path}WorldGame(_parent,bridge){const record={emitIntent:(intent)=>bridge.emitIntent(intent),world:'${args.path}',x:1234,y:567,destroyed:false,destroy(){this.destroyed=true}};globalThis.menuTestRecords.worlds.push(record);return record}` }))
      plugin.onResolve({ filter: /\/neonAuthentication$/ }, () => ({ path: 'auth', namespace: 'auth-test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'auth-test' }, () => ({ contents: `export const neonAuth={signOut:async()=>{globalThis.menuTestRecords.signouts++;return {error:{message:'Simulated offline logout'}}}};export const getPlayerCredentials=async()=>undefined;` }))
      plugin.onResolve({ filter: /\/AreaConnection$/ }, () => ({ path: 'presence', namespace: 'presence-test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'presence-test' }, () => ({ contents: `export class AreaConnection {
        state={status:'connected',remotes:[],chatMessages:[]};subscribe=()=>()=>{};getSnapshot=()=>this.state;
        start(){globalThis.menuTestRecords.starts++}stop(){globalThis.menuTestRecords.stops++}
      }` }))
    } }],
  })
  await writeFile(file, built.outputFiles[0].contents)
  const { mount, act } = await import(pathToFileURL(file).href)
  const click = async (selector: string) => { const button = dom.window.document.querySelector<HTMLElement>(selector); assert.ok(button, selector); await act(async () => button.click()) }
  let leakedStarts = 0
  const countStart = () => leakedStarts++
  dom.window.addEventListener('mousedown', countStart)
  dom.window.addEventListener('touchstart', countStart)
  async function assertUiInputContained(selector: string) {
    const element = document.querySelector(selector)!
    assert.ok(element)
    const previous = leakedStarts
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }))
      element.dispatchEvent(new dom.window.Event('touchstart', { bubbles: true }))
    })
    assert.equal(leakedStarts, previous, `${selector} must not reach Phaser's window input listeners`)
  }
  const settle = async () => { await act(async () => { await new Promise((done) => setTimeout(done, 20)) }) }
  for (const [path, width, height] of [['/play', 1280, 800], ['/town', 1280, 800], ['/play', 390, 844], ['/town', 360, 800]] as const) {
    overview.friends = [friend]; overview.incomingRequests = [incoming]; overview.outgoingRequests = []
    Object.defineProperty(dom.window, 'innerWidth', { value: width, configurable: true })
    Object.defineProperty(dom.window, 'innerHeight', { value: height, configurable: true })
    const before = { worlds: records.worlds.length, bootstrap: records.bootstrap, starts: records.starts, stops: records.stops }
    let root: { unmount(): void }
    await act(async () => { root = mount(path) }); await settle()
    const world = records.worlds.at(-1)!
    // Development permits a preview world before bootstrap; measure menu stability after authentication settles.
    const mountedWorldCount = records.worlds.length
    const connectedPresence = { starts: records.starts, stops: records.stops }
    assert.ok(mountedWorldCount > before.worlds)
    assert.equal(world.destroyed, false)
    assert.equal(records.bootstrap, before.bootstrap + 1)
    assert.ok(document.querySelector('.game-header__left button[aria-label="Chat"]'))
    const logo = document.querySelector('.game-header__brand img')!
    assert.equal(logo.getAttribute('src'), '/assets/branding/cactigrow-logo.png')
    assert.equal(logo.getAttribute('alt'), 'CactiGrow')
    assert.ok(document.querySelector('.game-header__center button[aria-label="Open own profile"]'))
    assert.ok(document.querySelector('.game-header__center button[aria-label="Inventory"]'))
    assert.ok(document.querySelector('.game-header__right .world-nav__control'))
    if (path === '/town') {
      for (const locationId of ['shop', 'market']) {
        await act(async () => world.emitIntent({ type: 'ENTER_LOCATION', locationId }))
        await settle()
        assert.ok(document.querySelector(`.feature-panel--${locationId}`))
        assert.match(document.querySelector('.commerce')!.textContent!, locationId === 'shop' ? /San Pedro seeds/ : /No matching listings/)
        assert.equal(document.querySelector('#test-path')?.textContent, '/town')
        assert.equal(records.worlds.length, mountedWorldCount)
        assert.deepEqual([world.x, world.y], [1234, 567])
        assert.equal(records.starts, connectedPresence.starts)
        assert.equal(records.stops, connectedPresence.stops)
        await assertUiInputContained('.commerce button')
        await click('button[aria-label="Close feature panel"]')
        assert.equal(world.destroyed, false)
      }
    }
    await assertUiInputContained('button[aria-label="Inventory"]')
    await assertUiInputContained('.world-nav__control')
    assert.ok(document.querySelector('.game-header .world-nav'), 'Travel is in the top HUD')
    assert.equal(document.querySelector('.world-page > .world-nav'), null, 'no world action bar')
    await click('button[aria-label="Inventory"]')
    assert.ok(document.querySelector('.feature-panel__content #inventory-title'))
    await assertUiInputContained('.feature-panel')
    assert.equal(document.querySelector('[role="tablist"]'), null, 'no global feature tabs')
    await click('button[aria-label="Close feature panel"]')
    async function launch(category: string, label: string) {
      await click('button[aria-label="Menu"]')
      assert.equal(document.querySelector('.feature-panel'), null, 'Menu does not open feature content')
      const categories = [...document.querySelectorAll('.menu-dropdown__category')]
      assert.equal(categories.length, 3)
      assert.ok(categories.every((item) => item.getAttribute('aria-expanded') === 'false'))
      const categoryButton = categories.find((item) => item.textContent?.includes(category)) as HTMLElement
      await act(async () => categoryButton.click())
      if (category === 'Game') assert.doesNotMatch(document.querySelector('.menu-dropdown__items')!.textContent!, /Mail/)
      await assertUiInputContained('.menu-dropdown__items button')
      const item = [...document.querySelectorAll<HTMLElement>('.menu-dropdown__items button')].find((item) => label === 'Mail' ? item.textContent?.startsWith('Mail') : item.textContent === label)!
      assert.ok(item, label)
      if (label === 'Mail') assert.equal(item.querySelector('.mail-badge')?.getAttribute('aria-label'), '2 unread messages')
      await act(async () => item.click())
      assert.equal(document.querySelector('.menu-dropdown'), null)
      assert.ok(document.querySelector('.feature-panel'))
    }
    for (const label of ['Skills', 'Journal', 'Research', 'Achievements', 'Mail', 'Settings', 'Help']) {
      await launch(['Settings', 'Help'].includes(label) ? 'Other' : label === 'Mail' ? 'Social' : 'Game', label)
      assert.equal(document.querySelector('#test-path')?.textContent, path)
      assert.equal(world.destroyed, false)
      assert.equal(records.worlds.length, mountedWorldCount)
      assert.deepEqual([world.x, world.y], [1234, 567])
      await click('button[aria-label="Close feature panel"]')
    }
    await click('button[aria-label="Open own profile"]')
    assert.match(document.querySelector('.feature-panel')!.textContent!, /Total Level/)
    assert.ok(document.querySelector('.profile-skills:not([open])'))
    await click('button[aria-label="Close feature panel"]')
    failSocial = true
    await launch('Social', 'Friends')
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /Could not refresh friends/)
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /Test Bravo/)
    assert.equal(world.destroyed, false)
    failSocial = false
    await click('.feature-panel__content [role="alert"] button')
    await assertUiInputContained('#player-search-name')
    const searchInput = document.querySelector<HTMLInputElement>('#player-search-name')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(searchInput, 'Delta')
      searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await act(async () => document.querySelector('.player-search form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(document.querySelector('.player-search')!.textContent!, /Test Delta/)
    await assertUiInputContained('.player-search li > button:last-child')
    await click('.player-search li > button:last-child')
    assert.match(document.querySelector('.player-search')!.textContent!, /Pending/)

    await click('.friends-list .social-player-link')
    assert.ok(document.querySelector('.social-overlay .player-profile'))
    assert.match(document.querySelector('.social-overlay')!.textContent!, /Total Level10/)
    assert.ok(document.querySelector('.social-overlay .profile-skills:not([open])'))
    await click('button[aria-label="Close player profile"]')
    assert.ok(document.querySelector('.feature-panel__content #friends-title'))
    await click('.friends-list .social-player-list li > button:last-child')
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /No friends yet/)
    await click('.feature-panel__content .social-switcher button:nth-child(2)')
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /Test Charlie/)
    await click('.friends-list .social-player-list li > span button:first-child')
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /No incoming requests/)
    await click('.feature-panel__content .social-switcher button:first-child')
    assert.match(document.querySelector('.feature-panel__content')!.textContent!, /Test Charlie/)
    await click('button[aria-label="Close feature panel"]')
    assert.equal(document.querySelector('.feature-panel'), null)
    assert.equal(document.querySelector('#test-path')?.textContent, path)
    assert.equal(world.destroyed, false)
    assert.equal(records.bootstrap, before.bootstrap + 1)
    assert.equal(records.stops, connectedPresence.stops)
    assert.equal(records.starts, connectedPresence.starts)
    await click('button[aria-label="Chat"]')
    assert.ok(document.querySelector('#world-chat-hud'))
    await assertUiInputContained('#world-chat-hud')
    await click('button[aria-label="Collapse HUD"]')
    assert.equal(document.querySelector('#hud-controls')?.hasAttribute('hidden'), true)
    assert.ok(document.querySelector('#world-chat-hud'), 'HUD collapse leaves chat open')
    await click('button[aria-label="Expand HUD"]')
    await click('button[aria-label="Inventory"]')
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('.feature-panel'), null)
    assert.ok(document.querySelector('#world-chat-hud'), 'closing feature leaves chat open')
    await click('button[aria-label="Menu"]')
    await click('.menu-dropdown section:last-child > button')
    assert.equal(document.querySelector('.menu-dropdown a'), null)
    assert.deepEqual([...document.querySelectorAll('.menu-dropdown__items button')].map((button) => button.textContent), ['Help', 'Settings', 'Sign Out', 'Developer Tools'])
    assert.equal(document.querySelector('.menu-dropdown__items')?.lastElementChild?.textContent, 'Developer Tools')
    await click('button[aria-label="Menu"]')
    await launch('Other', 'Developer Tools')
    await settle()
    assert.ok(document.querySelector('.feature-panel--devtools'))
    await assertUiInputContained('.feature-panel--devtools')
    const devSection = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-tools__nav button')).find(b => b.textContent === 'System')!
    await act(async () => devSection.click())
    const copy = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-tools button')).find(b => b.textContent === 'Copy Debug Snapshot')!
    const copiesBefore = records.snapshots
    await act(async () => copy.click())
    assert.equal(records.snapshots, copiesBefore + 1)
    const inspect = document.querySelector('.dev-tools details summary') as HTMLElement
    await act(async () => inspect.click())
    assert.match(document.querySelector('.dev-tools pre')!.textContent!, /"panel": "devtools"/)
    assert.equal(world.destroyed, false)
    assert.equal(records.worlds.length, mountedWorldCount)
    assert.equal(records.starts, connectedPresence.starts)
    assert.equal(records.stops, connectedPresence.stops)
    assert.equal(world.x, 1234); assert.equal(world.y, 567)
    const worldSection = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-tools__nav button')).find(b => b.textContent === 'World')!
    await act(async () => worldSection.click())
    const dock = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-tools button')).find(b => b.textContent === 'Dock panel for world preview')!
    await act(async () => dock.click())
    assert.equal(document.querySelector('.feature-panel--devtools')!.getAttribute('aria-modal'), 'false')
    assert.equal(document.querySelector('#main-content')!.hasAttribute('inert'), false)
    await click('button[aria-label="Close feature panel"]')
    assert.equal(document.querySelector('#test-path')!.textContent, path)
    const signoutsBefore = records.signouts
    await launch('Other', 'Sign Out')
    assert.match(document.querySelector('.feature-panel')!.textContent!, /Sign out of CactiGrow\?/)
    assert.equal(records.signouts, signoutsBefore, 'opening confirmation never signs out')
    await click('[aria-label="Sign out confirmation"] button:first-of-type')
    assert.equal(records.signouts, signoutsBefore, 'Cancel never signs out')
    assert.equal(document.querySelector('.feature-panel'), null)
    await launch('Other', 'Sign Out')
    await click('[aria-label="Sign out confirmation"] button:last-of-type')
    assert.equal(records.signouts, signoutsBefore + 1, 'only explicit confirmation invokes existing logout')
    assert.match(document.querySelector('.feature-panel')!.textContent!, /Unable to sign out/)
    await click('button[aria-label="Close feature panel"]')
    assert.equal(world.destroyed, false)
    assert.equal(records.worlds.length, mountedWorldCount)
    await act(async () => root!.unmount())
    assert.equal(world.destroyed, true)
  }
  for (const [path, selector] of [['/friends', '#friends-title'], ['/profile', '#own-profile-title'], ['/inventory', '#inventory-title'], ['/settings', '#settings-title'], ['/journal', '#journal-title']]) {
    let root: { unmount(): void }
    await act(async () => { root = mount(path) }); await settle()
    assert.ok(document.querySelector(selector), path)
    assert.equal(document.querySelector('#test-path')?.textContent, path)
    await act(async () => root!.unmount())
  }
  let homeRoot: { unmount(): void }
  await act(async () => { homeRoot = mount('/home') }); await settle()
  await click('.home-nav button:nth-child(3)')
  await click('.home-section-grid .home-room button')
  assert.ok(document.querySelector('.feature-panel__content #friends-title'), 'existing Home Friends button opens the Friends feature panel')
  assert.equal(document.querySelector('#test-path')?.textContent, '/home')
  await act(async () => homeRoot!.unmount())
})
