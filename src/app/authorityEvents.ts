export const GROWER_AUTHORITY_CHANGED_EVENT = 'cactigrow:grower-authority-changed'
export const PLANT_AUTHORITY_CHANGED_EVENT = 'cactigrow:plant-authority-changed'
export const GARDEN_AUTHORITY_CHANGED_EVENT = 'cactigrow:garden-authority-changed'
export function notifyGrowerAuthorityChanged() { window.dispatchEvent(new Event(GROWER_AUTHORITY_CHANGED_EVENT)) }
