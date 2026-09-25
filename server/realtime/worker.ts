// Isolated local entrypoint. The application Worker does not import this module in L2.
export { AreaPresence } from './AreaPresence.ts'
export default { fetch() { return new Response('Not found', { status: 404 }) } } satisfies ExportedHandler
