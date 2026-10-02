export function SettingsPanel() {
  return <section aria-labelledby="settings-title"><h3 id="settings-title">Settings</h3>
    <p>Coming Soon - game settings are under construction.</p>
    <p>Use the CactiGrow logo to collapse or expand the HUD. Chat stays open independently.</p>
  </section>
}

export function HelpPanel() {
  return <section aria-labelledby="help-title"><h3 id="help-title">Getting around CactiGrow</h3>
    <dl className="help-topics">
      <div><dt>Movement</dt><dd>Click or tap the ground to move. On desktop you can also use the movement keys. Walk to a building or use Travel to enter it.</dd></div>
      <div><dt>Farm and Town</dt><dd>Your Farm contains Home, Nursery, Garden, Lab, and Mailbox. Take the road to Town to meet other players.</dd></div>
      <div><dt>Players and profiles</dt><dd>Click or tap another Town player to view their profile. Your own player card opens your profile and skill breakdown.</dd></div>
      <div><dt>Chat</dt><dd>The Chat button beside the logo toggles the floating bottom-left conversation panel. World chat and DMs are live while connected in Town.</dd></div>
      <div><dt>Inventory</dt><dd>Use the backpack to open Inventory without leaving your location.</dd></div>
      <div><dt>Friends</dt><dd>Open Menu, Social, Friends to search character names, manage requests, and view blocked players.</dd></div>
      <div><dt>More world, less HUD</dt><dd>Tap the logo to hide the other HUD controls. Tap it again to restore them. Open chat stays visible.</dd></div>
    </dl><p>More Help Coming Soon</p>
  </section>
}
