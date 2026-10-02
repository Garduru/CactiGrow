import type { SyntheticEvent } from 'react'

// Phaser listens for mouse/touch starts on window as well as the canvas.
// UI clicks must never become movement or world interaction intents.
function stopWorldInput(event: SyntheticEvent) { event.stopPropagation() }
export const worldInputBoundary = { onMouseDown: stopWorldInput, onTouchStart: stopWorldInput }
