# Development World Edit

World Edit is a temporary geometry preview tool for the Phaser Farm and Town. Run the Vite development server and open `/` or `/town` with `?worldEdit`, for example `http://localhost:5173/?worldEdit`. It is available only in development builds. `?worldDebug` continues to work separately; World Edit supplies its own selected-object overlay and live physics outlines. The panel is React UI over the Phaser canvas.

Select an object by clicking/tapping its visual bounds in **Edit Geometry** mode or by choosing it from the panel. Farm supports Nursery, Home, Garden, Genetics Lab, Mailbox, and Road to Town. Town supports Shop, Marketplace/Exchange, and Road to Farm. The selected bounds, colliders, interaction circle, approach points, return/arrival spawn, and any named anchors are shown on the world. Garden's six collection-display anchors are editable preview points. No Nursery interior bench anchors exist yet.

Drag the selected sprite to move its visual anchor. **Move associated geometry with object** defaults on: sprite dragging or typing a new sprite X/Y translates colliders, interaction, approaches, and named anchors by the same delta. It does **not** move return spawns automatically; drag or type those explicitly. Turn the option off to move only the sprite. Numeric panel fields also let you enter exact width/height and origin values. For graybox destinations, resizing changes the primary visual body; secondary doors/windows/posts translate with the body but are not individually resized in V1.

Select a collider by clicking inside it. Drag its interior to move it. Drag a visible edge handle to resize that edge, or a corner handle to resize two edges together. The minimum width and height are 10 world units. **+ Add Collider** creates an 80 × 60 rectangle at the selected object's anchor; **Delete Collider** removes that rectangle. The active Phaser Arcade physics body is rebuilt immediately after every change, including additions and deletions.

Drag interaction, approach, return/spawn, or named-anchor markers directly, or enter their X/Y fields. Interaction radius is edited numerically and shown as a circle. Mailbox's four approach candidates are separate editable points. Switch to **Test Movement** to walk with WASD/arrows, use E, click/tap to move, and test current draft collisions without leaving the editor. Switch back to **Edit Geometry** for selection and dragging. Wheel zoom remains available; two-finger pinch zoom is available while editing or testing. Editing gestures do not issue world-navigation intents.

**Copy Values** copies the selected object's current draft as indented JSON, using world-coordinate centers for rectangular colliders:

```json
{
  "id": "mail",
  "label": "Mailbox",
  "sprite": { "x": 1120, "y": 1640, "width": 300, "height": 200, "originX": 0.5, "originY": 1 },
  "colliders": [{ "id": "mail-0", "label": "MAILBOX LOWER COLLIDER", "x": 1120, "y": 1580, "width": 240, "height": 100 }],
  "interaction": { "x": 1120, "y": 1575, "radius": 160 },
  "approaches": [{ "id": "FRONT", "label": "Approach FRONT", "x": 1120, "y": 1665 }],
  "returnSpawn": { "id": "mailbox-exterior", "label": "Return spawn", "x": 1220, "y": 1665 },
  "anchors": []
}
```

The example abbreviates the actual Mailbox arrays. **Copy All Edited Objects** copies the current world's full draft array in the same JSON form. **Reset Selected** restores only that object to its authoritative source configuration.

Drafts live only in browser memory for the current page session. They are not saved to localStorage, TypeScript source, game state, a database, or Base44. Draft return-spawn coordinates are previewed on subsequent editor-mode scene entry within the same session; they are not authoritative. To keep a tune, copy the JSON and explicitly transfer reviewed values into authoritative layout/config in a separate change. Locked Farm assets remain locked even if the editor previews alternate values.
