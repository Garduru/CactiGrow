export interface Point { x: number; y: number }
export interface Obstacle { x: number; y: number; width: number; height: number }
interface Rect { left: number; right: number; top: number; bottom: number }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(v, high))
const inside = (p: Point, r: Rect) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom

// Open rectangle intersection: travelling along an inflated boundary is safe.
function crosses(a: Point, b: Point, r: Rect): boolean {
  let lo = 0, hi = 1
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
    if (Math.abs(delta) < 1e-9) { if (start <= min || start >= max) return false; continue }
    const t1 = (min - start) / delta, t2 = (max - start) / delta
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2))
    if (hi - lo < 1e-9) return false
  }
  return hi > 0 && lo < 1 && hi - lo > 1e-9
}

/** Static visibility graph derived from the same rectangles registered with Arcade physics. */
export class NavigationMap {
  readonly obstacles: readonly Rect[]
  readonly nodes: readonly Point[]
  private readonly solids: readonly Rect[]
  private readonly physical: readonly Rect[]
  private readonly bounds: Rect
  private readonly edges: { to: number; cost: number }[][]

  constructor(width: number, height: number, obstacles: readonly Obstacle[], radius = 27, margin = 5) {
    const expand = (amount: number) => obstacles.map((r) => ({ left: r.x - r.width / 2 - amount, right: r.x + r.width / 2 + amount, top: r.y - r.height / 2 - amount, bottom: r.y + r.height / 2 + amount }))
    this.solids = expand(0)
    this.obstacles = expand(radius + margin)
    this.physical = expand(radius - 0.1)
    this.bounds = { left: radius, top: radius, right: width - radius, bottom: height - radius }
    const candidates = this.obstacles.flatMap((r) => [{ x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.left, y: r.bottom }, { x: r.right, y: r.bottom }])
    this.nodes = candidates.filter((p, i) => this.walkable(p) && candidates.findIndex((q) => distance(p, q) < 0.01) === i)
    this.edges = this.nodes.map(() => [])
    for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) {
      if (!this.clear(this.nodes[i], this.nodes[j])) continue
      const cost = distance(this.nodes[i], this.nodes[j])
      this.edges[i].push({ to: j, cost }); this.edges[j].push({ to: i, cost })
    }
  }

  walkable(p: Point): boolean {
    return Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= this.bounds.left && p.x <= this.bounds.right && p.y >= this.bounds.top && p.y <= this.bounds.bottom && !this.obstacles.some((r) => inside(p, r))
  }
  clear(a: Point, b: Point): boolean { return this.walkable(a) && this.walkable(b) && !this.obstacles.some((r) => crosses(a, b, r)) }

  /** Interaction sight does not require the other avatar to share our navigation margin. */
  visible(a: Point, b: Point): boolean { return !this.solids.some((r) => inside(a, r) || inside(b, r) || crosses(a, b, r)) }

  private candidates(p: Point): Point[] {
    const bounded = { x: clamp(p.x, this.bounds.left, this.bounds.right), y: clamp(p.y, this.bounds.top, this.bounds.bottom) }
    return [bounded, ...this.obstacles.flatMap((r) => [
      { x: r.left, y: clamp(bounded.y, r.top, r.bottom) }, { x: r.right, y: clamp(bounded.y, r.top, r.bottom) },
      { x: clamp(bounded.x, r.left, r.right), y: r.top }, { x: clamp(bounded.x, r.left, r.right), y: r.bottom },
    ]), ...this.nodes].filter((q) => this.walkable(q)).sort((a, b) => distance(a, p) - distance(b, p))
  }

  route(start: Point, requested: Point): Point[] | null {
    if (![start.x, start.y, requested.x, requested.y].every(Number.isFinite)) return null
    // Keyboard movement can stop in the extra margin. Escape it without crossing physical solids.
    if (!this.walkable(start)) {
      const escape = this.candidates(start).find((p) => distance(start, p) <= 12 && !this.physical.some((r) => inside(start, r) || crosses(start, p, r)))
      if (!escape) return null
      const remaining = this.route(escape, requested)
      return remaining ? [escape, ...remaining] : null
    }
    // A valid but disconnected destination is rejected, rather than walking somewhere unrelated.
    const goals = this.walkable(requested) ? [requested] : this.candidates(requested).slice(0, 24)
    for (const goal of goals) {
      const path = this.findRoute(start, goal)
      if (path) return path
    }
    return null
  }

  private findRoute(start: Point, goal: Point): Point[] | null {
    if (this.clear(start, goal)) return [goal]
    const nodes = [...this.nodes, start, goal], source = nodes.length - 2, target = source + 1
    const edges = this.edges.map((list) => [...list]); edges.push([], [])
    for (const id of [source, target]) for (let j = 0; j < this.nodes.length; j++) if (this.clear(nodes[id], nodes[j])) {
      const cost = distance(nodes[id], nodes[j]); edges[id].push({ to: j, cost }); edges[j].push({ to: id, cost })
    }
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), open = new Set<number>([source])
    costs[source] = 0
    while (open.size) {
      const current = [...open].reduce((a, b) => costs[a] + distance(nodes[a], goal) <= costs[b] + distance(nodes[b], goal) ? a : b)
      if (current === target) {
        const path: Point[] = []
        for (let i = target; i !== source; i = previous[i]) path.unshift(nodes[i])
        return this.simplify(start, path)
      }
      open.delete(current)
      for (const edge of edges[current]) if (costs[current] + edge.cost + 1e-7 < costs[edge.to]) {
        costs[edge.to] = costs[current] + edge.cost; previous[edge.to] = current; open.add(edge.to)
      }
    }
    return null
  }

  simplify(start: Point, path: readonly Point[]): Point[] {
    const result: Point[] = []; let from = start, index = 0
    while (index < path.length) {
      let next = path.length - 1
      while (next > index && !this.clear(from, path[next])) next--
      result.push(path[next]); from = path[next]; index = next + 1
    }
    return result
  }
}
