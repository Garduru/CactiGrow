/** Response-time server anchor; monotonic elapsed time ignores device clock skew/jumps. */
export class TutorialClock {
  private anchor: { server: number; elapsed: number } | null = null
  private readonly elapsed: () => number
  private readonly wall: () => number
  constructor(elapsed = () => performance.now(), wall = () => Date.now()) { this.elapsed = elapsed; this.wall = wall }
  sync(serverNow?: string) {
    const server = Date.parse(serverNow ?? '')
    if (Number.isFinite(server)) this.anchor = { server, elapsed: this.elapsed() }
  }
  now() { return this.anchor ? this.anchor.server + this.elapsed() - this.anchor.elapsed : this.wall() }
}
