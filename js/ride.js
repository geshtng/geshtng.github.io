// The ride: vertical scrolling drives a train along a pixel rail line. The scene is drawn on a
// low-res canvas in layers that move at different speeds (far mountains, skyline, town, track);
// the train stays in the middle, slows into each station, and that stop's panel slides in.

const H = 240 // canvas height in scene pixels; the width follows the viewport's aspect
const HORIZON = 150
const SKYLINE = 176
const TOWN = 192
const WIRE = 197
const TRAIN_TOP = 201
const RAIL = 218
const DECK = 219
const RIVER = 225
const SPACING = 520 // scene pixels between stations
const DWELL = 0.35 // share of each leg spent standing at the station
const SCROLL_PER_STOP = 1.1 // viewport heights of scrolling per leg
const LAYERS = [
    ["far", 0.04],
    ["mid", 0.35],
    ["near", 0.65],
    ["track", 1],
]

/** Matches the git-lofi city's palettes, so the ride and the hero GIF agree. */
const PALETTES = {
    night: { sky: ["#060a1c", "#23305e"], mountain: "#222c52", snow: "#c6d0ee", far: "#141b3a", near: "#0b102b", roof: "#060a1d", ground: "#04071a", glow: "#ffcc66", stars: true, moon: true },
    dusk: { sky: ["#2a1f4f", "#f29e6d"], mountain: "#4d3f6e", snow: "#f3dfe8", far: "#3a2c58", near: "#211836", roof: "#160f26", ground: "#120c1f", glow: "#ffd37a", stars: true },
    dawn: { sky: ["#34426e", "#f6c39f"], mountain: "#5f6c98", snow: "#ffffff", far: "#465180", near: "#28305a", roof: "#1b2246", ground: "#161b38", glow: "#ffe3a3" },
    day: { sky: ["#4a90d9", "#bfe3f5"], mountain: "#5b6f9e", snow: "#ffffff", far: "#7d8fb3", near: "#4a5677", roof: "#2f3654", ground: "#3a4058", glow: "#fff2c4" },
}
const KONBINI = [
    ["#0a9a4a", "#ffffff", "#1e64c8"],
    ["#1e5aa8", "#ffffff", "#1e5aa8"],
    ["#f58220", "#00843d", "#e2231a"],
]
const LIVERY = "#1e64c8"

/** Street trees follow the season in Jakarta's calendar, using git-lofi's northern-hemisphere months. */
const SEASONS = {
    spring: { crown: ["#f7b6c8", "#ffd3e0"], drift: "#ffc4d6" },
    summer: { crown: ["#3f7d4a", "#5a9a52"], drift: "#6fae5c" },
    autumn: { crown: ["#d9622b", "#e8a33d"], drift: "#e0712c" },
    winter: { crown: null, drift: "#ffffff" },
}
const seasonNow = () => {
    const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", month: "numeric" }).format(new Date()))
    return month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter"
}

const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return [n >> 16, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => {
    const [x, y] = [rgb(a), rgb(b)]
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")
}
const clamp = (v, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi)
const smooth = (t) => t * t * (3 - 2 * t)

function rng(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function surface(width) {
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(width)
    canvas.height = H
    const ctx = canvas.getContext("2d")
    const rect = (x, y, w, h, color) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }
    return { canvas, ctx, rect }
}

/** Draws every static layer once for a palette and viewport width; frames only slice them. */
function buildLayers(p, viewW, stations, season, dark) {
    // Windows and lamp heads glow when it's dark; by day they're plain glass and metal.
    const windowLit = dark ? p.glow : mix(p.near, p.sky[1], 0.35)
    const lampHead = dark ? p.glow : mix(p.roof, "#ffffff", 0.3)
    const legs = (stations.length - 1) * SPACING
    const layers = {}
    for (const [name, speed] of LAYERS) layers[name] = surface(legs * speed + viewW + 2)

    // Sky and moon, fixed to the screen.
    const sky = surface(viewW)
    const gradient = sky.ctx.createLinearGradient(0, 0, 0, HORIZON)
    gradient.addColorStop(0, p.sky[0])
    gradient.addColorStop(1, p.sky[1])
    sky.ctx.fillStyle = gradient
    sky.ctx.fillRect(0, 0, viewW, H)
    if (p.moon) {
        const [mx, my] = [Math.round(viewW * 0.82), 34]
        for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dy * dy <= 80) sky.rect(mx + dx, my + dy, 1, 1, "#f6efcf")
        sky.rect(mx - 3, my - 2, 3, 2, "#e2d9b4")
        sky.rect(mx + 2, my + 3, 3, 2, "#e2d9b4")
    }

    // Far: a back ridge, one Fuji, and foothills. The layer drifts so slowly that Fuji
    // stays in view for the whole ride.
    const far = layers.far
    const ridge = mix(p.mountain, p.sky[1], 0.4)
    for (let x = 0; x < far.canvas.width; x++) {
        const top = 126 + Math.sin(x / 37) * 7 + Math.sin(x / 13) * 2
        far.rect(x, top, 1, HORIZON - top + 1, ridge)
    }
    {
        const peak = far.canvas.width / 2 + viewW * 0.12
        const summit = 52
        const snowLine = summit + 16
        for (let y = summit; y <= HORIZON; y++) {
            const d = y - summit
            const half = 5 + d * 0.9 + 0.006 * d * d
            for (let x = Math.ceil(peak - half); x <= peak + half; x++) {
                const capped = y < snowLine + Math.sin(x * 0.7) * 2 + Math.max(0, Math.sin(x * 0.31)) * 5
                const shaded = x > peak + 2 + d * 0.15
                far.rect(x, y, 1, 1, mix(capped ? p.snow : p.mountain, capped ? p.mountain : "#000000", shaded ? 0.25 : 0))
            }
        }
    }
    const hill = mix(p.mountain, p.far, 0.5)
    for (let x = 0; x < far.canvas.width; x++) {
        const top = 141 + Math.sin(x / 23 + 1) * 4 + Math.sin(x / 7) * 1.5
        far.rect(x, top, 1, HORIZON - top + 1, hill)
    }

    // Mid: the city skyline with lit windows.
    let r = rng(23)
    const mid = layers.mid
    for (let x = 0; x < mid.canvas.width; ) {
        const w = 10 + r() * 16
        const h = 12 + r() * 44
        mid.rect(x, SKYLINE - h, w, TOWN - SKYLINE + h, p.far)
        for (let wy = SKYLINE - h + 3; wy < SKYLINE; wy += 4)
            for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() < 0.32) mid.rect(wx, wy, 1, 2, dark ? mix(p.far, p.glow, 0.65) : mix(p.far, p.sky[1], 0.3))
        if (h > 44 && r() < 0.5) mid.rect(x + w / 2, SKYLINE - h - 5, 1, 5, p.far)
        x += w + r() * 3
    }

    // Near: houses with tiled roofs, konbini, trees, lamps, and poles with sagging wires.
    // Tree crowns are drawn live each frame so they can sway; only trunks go in the layer.
    r = rng(37)
    const near = layers.near
    const trees = []
    const lamps = []
    const cats = []
    const konbini = []
    const stalls = []
    for (let x = r() * 20; x < near.canvas.width; ) {
        const kind = r()
        if (kind < 0.36) {
            const w = 18 + r() * 12
            const h = 11 + r() * 7
            const top = TOWN - h
            near.rect(x, top, w, h, p.near)
            for (let k = 0; k < 4; k++) near.rect(x - 2 + k * 2, top - 1 - k, w + 4 - k * 4, 1, k === 0 ? mix(p.roof, p.glow, 0.1) : p.roof)
            if (r() < 0.75) {
                near.rect(x + w / 2 - 3, top + 4, 6, 4, windowLit)
                near.rect(x + w / 2, top + 4, 1, 4, mix(windowLit, p.near, 0.4))
            }
            if (r() < 0.12) cats.push({ x: Math.round(x + w / 2 - 2), y: Math.round(top - 4), phase: r() * 6 })
            x += w + 3 + r() * 8
        } else if (kind < 0.46) {
            const stripes = KONBINI[Math.floor(r() * KONBINI.length)]
            near.rect(x, TOWN - 16, 30, 16, mix("#ffffff", p.near, 0.3))
            stripes.forEach((c, i) => near.rect(x, TOWN - 16 + i, 30, 1, c))
            near.rect(x + 2, TOWN - 11, 26, 11, mix("#ffffff", p.glow, 0.3))
            for (let gx = x + 2; gx < x + 30; gx += 7) near.rect(gx, TOWN - 11, 1, 11, mix("#ffffff", p.near, 0.5))
            konbini.push(x + 15)
            x += 36 + r() * 8
        } else if (kind < 0.53) {
            // A ramen stall: wooden front, eave, indigo noren curtain, red paper lanterns.
            const top = TOWN - 13
            const lantern = dark ? "#ff4a3a" : mix("#ff4a3a", p.near, 0.35)
            near.rect(x, top, 22, 13, mix("#5a3a28", p.near, 0.35))
            near.rect(x - 2, top - 2, 26, 2, p.roof)
            near.rect(x + 5, top + 1, 12, 3, windowLit)
            for (let nx = x + 5; nx < x + 17; nx += 3) near.rect(nx, top + 4, 2, 4, "#26305e")
            near.rect(x + 5, top + 8, 12, 5, mix(windowLit, p.near, 0.3))
            for (const lx of [x + 1, x + 19]) {
                near.rect(lx, top + 1, 2, 4, lantern)
                near.rect(lx, top + 2, 2, 1, mix(lantern, "#000000", 0.3))
            }
            stalls.push({ x: x + 11, y: top - 2, lanterns: [x + 2, x + 20], ly: top + 3 })
            x += 28 + r() * 8
        } else if (kind < 0.85) {
            const size = 7 + Math.round(r() * 4)
            near.rect(x + 3, TOWN - size - 3, 2, size + 3, p.roof)
            trees.push({ x: x + 4, y: TOWN - size * 2 - 2, size, phase: r() * 6, crown: makeCrown(size, r) })
            x += size * 2 + 4 + r() * 6
        } else {
            near.rect(x, TOWN - 12, 1, 12, p.roof)
            near.rect(x - 1, TOWN - 13, 3, 1, lampHead)
            lamps.push({ x, flicker: r() < 0.12, phase: r() * 6 })
            x += 14 + r() * 10
        }
    }
    near.rect(0, TOWN, near.canvas.width, TRAIN_TOP - TOWN, p.ground)
    for (let x = 0; x < near.canvas.width; x += 10) near.rect(x, TOWN + 4, 5, 1, mix(p.ground, p.glow, 0.12))

    // A street lamp roughly every 60px, on top of whatever stands behind it.
    for (let x = 18 + r() * 20; x < near.canvas.width; x += 52 + r() * 16) {
        near.rect(x, TOWN - 12, 1, 12, p.roof)
        near.rect(x - 1, TOWN - 13, 3, 1, lampHead)
        lamps.push({ x, flicker: r() < 0.12, phase: r() * 6 })
    }
    const poles = []
    for (let x = 30; x < near.canvas.width + 80; x += 80) poles.push(x)
    for (const x of poles) {
        near.rect(x, 152, 2, TOWN - 152, p.roof)
        near.rect(x - 4, 155, 10, 1, p.roof)
    }
    for (let i = 0; i + 1 < poles.length; i++)
        for (const [wy, sag] of [[155, 7], [158, 6]])
            for (let x = poles[i]; x < poles[i + 1]; x++) {
                const u = (x - poles[i]) / (poles[i + 1] - poles[i])
                near.rect(x, wy + sag * 4 * u * (1 - u), 1, 1, p.roof)
            }

    // Track: street, overhead line, rail bridge, river, and a station per stop.
    const track = layers.track
    const width = track.canvas.width
    const deck = mix(p.near, p.ground, 0.5)
    track.rect(0, TRAIN_TOP, width, RAIL - TRAIN_TOP, mix(p.ground, p.sky[1], 0.15))
    for (let x = 20; x < width; x += 64) {
        track.rect(x, WIRE - 1, 2, RAIL - WIRE + 1, deck)
        track.rect(x - 3, WIRE - 1, 8, 1, deck)
    }
    track.rect(0, WIRE, width, 1, mix(deck, "#ffffff", 0.15))
    track.rect(0, RAIL, width, 1, mix(deck, "#ffffff", 0.3))
    for (let y = DECK; y < RIVER; y++)
        for (let x = 0; x < width; x++) {
            const row = (y - DECK) * 2
            const truss = x % 12 === row || 12 - (x % 12) === row
            if (y === DECK || truss) track.rect(x, y, 1, 1, mix(deck, "#ffffff", y === DECK ? 0.2 : 0.1))
            else track.rect(x, y, 1, 1, deck)
        }
    track.rect(0, RIVER, width, H - RIVER, mix(p.sky[1], p.ground, 0.65))
    stations.forEach((station, i) => {
        const cx = i * SPACING + viewW / 2
        track.rect(cx - 112, 193, 224, 3, p.roof)
        for (let x = cx - 104; x < cx + 108; x += 12) track.rect(x, 196, 2, 1, lampHead)
        for (const x of [cx - 110, cx, cx + 108]) track.rect(x, 196, 1, RAIL - 196, p.roof)
        track.rect(cx - 112, DECK, 224, 2, mix(deck, p.glow, 0.35))
        track.rect(cx - 12, 184, 24, 7, "#f2f2f2")
        track.rect(cx - 10, 186, 20, 2, station.line)
        track.rect(cx - 9, 191, 1, 2, p.roof)
        track.rect(cx + 8, 191, 1, 2, p.roof)
    })

    const { crown, drift } = SEASONS[season]
    return {
        sky,
        layers,
        deck,
        trees,
        lamps,
        cats,
        konbini,
        stalls,
        cat: mix(p.near, "#000000", 0.6),
        season,
        branch: p.roof,
        leaf: crown && [mix(crown[1], p.near, 0.2), mix(crown[0], p.near, 0.3), mix(crown[0], p.near, 0.55)],
        drift: mix(drift, p.near, 0.15),
        driftDark: mix(drift, p.near, 0.45),
        river: mix(p.sky[1], p.ground, 0.65),
    }
}

/** A four-car bullet train with long noses at both ends, drawn in screen space. */
function drawTrain(ctx, p, cx, bob, dark) {
    // Cabin lights glow warm in the dark; by day the windows read as bright glass.
    const lit = dark ? p.glow : mix("#cfe0ee", p.glow, 0.35)
    const rect = (x, y, w, h, color) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(x), Math.round(y + (y < RAIL - 1 ? bob : 0)), w, h)
    }
    const body = "#f1f3f5"
    const skirt = "#9aa3ad"
    const top = TRAIN_TOP + 3
    const bottom = RAIL - 2
    const cars = 4
    const carW = 40
    const nose = 22
    const length = nose * 2 + cars * (carW + 1) - 1
    const x0 = cx - length / 2
    const front = x0 + length - nose

    // Body, stripe, windows with passengers, skirt and bogies along the cars.
    const seat = rng(5)
    rect(x0 + nose, top, length - nose * 2, bottom - top, body)
    rect(x0 + nose, bottom, length - nose * 2, 1, skirt)
    for (let k = 0; k < cars; k++) {
        const x = x0 + nose + k * (carW + 1)
        if (k > 0) rect(x - 1, top + 1, 1, bottom - top - 1, mix(body, "#000000", 0.25))
        for (let wx = x + 3; wx + 2 <= x + carW - 2; wx += 4) {
            rect(wx, top + 3, 2, 2, lit)
            if (seat() < 0.5) rect(wx, top + 4, 2, 1, mix(p.near, lit, 0.3))
        }
        rect(x + 2, top + 2, 4, 6, mix(body, "#000000", 0.1))
        for (const bx of [x + 3, x + carW - 13]) rect(bx, RAIL - 1, 10, 1, "#14141c")
    }

    // Noses: a curve from the tip up to the roof, front and back, with a cockpit window.
    for (let j = 0; j < nose; j++) {
        const s = j / (nose - 1) // 0 at the tip, 1 where the nose meets the car
        const h = Math.round((bottom - top) * (1 - (1 - s) ** 2))
        for (const x of [front + nose - 1 - j, x0 + j]) {
            rect(x, bottom - h, 1, h, body)
            rect(x, bottom, 1, 1, skirt)
            if (bottom - h <= top + 7) rect(x, top + 7, 1, 2, LIVERY)
        }
        if (j > nose - 12 && j < nose - 4 && bottom - h <= top + 2) rect(front + nose - 1 - j, top + 2, 1, 2, "#1b2440")
    }
    rect(x0 + nose, top + 7, length - nose * 2, 2, LIVERY)
    rect(x0 + nose, top + 9, length - nose * 2, 1, mix(LIVERY, "#ffffff", 0.5))

    // Single-arm pantograph up to the overhead line.
    const px = x0 + nose + carW + carW / 2
    for (const [dx, y] of [[0, top - 1], [1, top - 2], [2, top - 3], [3, top - 4], [2, top - 5], [1, WIRE + 1]]) rect(px + dx, y, 1, 1, p.roof)
    rect(px - 1, WIRE + 1, 5, 1, p.roof)

    const tip = x0 + length - 1
    rect(tip - 2, bottom - 2, 2, 1, "#fff4c2")
    rect(x0 + 1, bottom - 2, 2, 1, "#ff4040")
    return { head: [tip, bottom - 2 + bob], tail: [x0 + 1, bottom - 2 + bob] }
}

/**
 * A leafy crown as a few overlapping clumps with ragged edges, split into light (upper left),
 * mid and dark (lower right) pixels, with speckles so it reads as foliage, not a ball.
 */
function makeCrown(size, r) {
    const clumps = [[0, -0.25, 0.75], [-0.55, 0.15, 0.6], [0.6, 0.2, 0.55], [0.15, -0.8, 0.45], [-0.3, -0.65, 0.4]]
    const shades = [[], [], []]
    const reach = Math.ceil(size * 1.3)
    for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
            const inside = clumps.some(([cx, cy, cr]) => Math.hypot(dx - cx * size, dy - cy * size) <= cr * size * (1 + (r() - 0.5) * 0.3))
            if (!inside || r() < 0.04) continue
            const light = (-dx - dy * 1.2) / size + (r() - 0.5) * 0.9
            shades[light > 0.6 ? 0 : light < -0.5 ? 2 : 1].push([dx, dy])
        }
    return shades
}

/** A cat sitting on a roof ridge: blinks now and then and flicks its tail. */
function drawCats(ctx, scene, offset, viewW, t) {
    for (const cat of scene.cats) {
        const x = cat.x - offset
        if (x < -10 || x > viewW + 10) continue
        const y = cat.y
        ctx.fillStyle = scene.cat
        ctx.fillRect(x, y - 5, 1, 1)
        ctx.fillRect(x + 3, y - 5, 1, 1)
        ctx.fillRect(x, y - 4, 4, 2)
        ctx.fillRect(x - 1, y - 2, 6, 2)
        const flick = Math.round(Math.sin(t * 2.5 + cat.phase))
        ctx.fillRect(x + 5, y - 1, 1, 1)
        ctx.fillRect(x + 6, y - 2, 1, 1)
        ctx.fillRect(x + 6 + flick, y - 3, 1, 1)
        if ((t * 0.4 + cat.phase) % 1 > 0.05) {
            ctx.fillStyle = "#c8f56a"
            ctx.fillRect(x + 1, y - 4, 1, 1)
            ctx.fillRect(x + 2, y - 4, 1, 1)
        }
    }
}

/**
 * The train's lights after dark: a tapered headlight cone that fades out ahead, a streak on
 * the rail, and a small red tail glow. Screen blending brightens what's underneath, so the
 * light reads as light even over rain.
 */
function drawTrainLights(ctx, lamps) {
    const [hx, hy] = lamps.head
    const [tx, ty] = lamps.tail
    ctx.save()
    ctx.globalCompositeOperation = "screen"
    const reach = 90
    const cone = ctx.createLinearGradient(hx, 0, hx + reach, 0)
    cone.addColorStop(0, "rgba(255, 244, 194, 0.55)")
    cone.addColorStop(0.35, "rgba(255, 244, 194, 0.18)")
    cone.addColorStop(1, "rgba(255, 244, 194, 0)")
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(hx, hy - 0.5)
    ctx.lineTo(hx + reach, hy - 9)
    ctx.lineTo(hx + reach, Math.min(hy + 6, RAIL))
    ctx.lineTo(hx, hy + 1.5)
    ctx.closePath()
    ctx.fill()
    const rail = ctx.createLinearGradient(hx, 0, hx + reach * 0.7, 0)
    rail.addColorStop(0, "rgba(255, 244, 194, 0.6)")
    rail.addColorStop(1, "rgba(255, 244, 194, 0)")
    ctx.fillStyle = rail
    ctx.fillRect(hx, RAIL, reach * 0.7, 1)
    const glow = ctx.createRadialGradient(tx, ty + 0.5, 0, tx, ty + 0.5, 6)
    glow.addColorStop(0, "rgba(255, 64, 64, 0.6)")
    glow.addColorStop(1, "rgba(255, 64, 64, 0)")
    ctx.fillStyle = glow
    ctx.fillRect(tx - 6, ty - 6, 12, 12)
    ctx.restore()
}

/** Tree crowns swaying in gusts: the top leans further than the bottom. Bare in winter. */
function drawTrees(ctx, scene, offset, viewW, t) {
    for (const tree of scene.trees) {
        const x = tree.x - offset
        if (x < -20 || x > viewW + 20) continue
        const r = tree.size
        const gust = 0.9 + 0.6 * Math.sin(t * 1.7 + tree.phase) + 0.3 * Math.sin(t * 4.3 + tree.phase * 2)
        if (!scene.leaf) {
            // Bare branches: a trunk and two forks per side, swaying, with snow on the tips.
            const base = tree.y + r * 2
            const sway = (h) => Math.round(-gust * 2.5 * (h / (r * 2)) ** 1.3)
            ctx.fillStyle = scene.branch
            for (let h = 0; h < r * 2; h++) ctx.fillRect(Math.round(x) + sway(h), base - h, 1, 1)
            for (const [start, side, len] of [[0.6, -1, 0.8], [0.8, 1, 0.9], [1.2, -1, 0.6], [1.35, 1, 0.55]]) {
                const h0 = Math.round(r * start)
                const n = Math.round(r * len)
                for (let i = 1; i <= n; i++) ctx.fillRect(Math.round(x) + side * i + sway(h0 + i), base - h0 - i, 1, 1)
                ctx.fillStyle = "#ffffff"
                ctx.fillRect(Math.round(x) + side * n + sway(h0 + n), base - h0 - n - 1, 2, 1)
                ctx.fillStyle = scene.branch
            }
            continue
        }
        const cx = Math.round(x)
        const cy = tree.y + r
        const lean = (dy) => Math.round(-gust * 3.5 * Math.max(0, (r - dy) / (2 * r)) ** 1.3)
        tree.crown.forEach((pixels, shade) => {
            ctx.fillStyle = scene.leaf[shade]
            for (const [dx, dy] of pixels) ctx.fillRect(cx + dx + lean(dy), cy + dy, 1, 1)
        })
    }
}

/**
 * Street traffic, sprites drawn facing right in a box `w` wide whose bottom sits on the street.
 * Each entry is [width, height, draw(rect, color, lit)].
 */
const VEHICLES = {
    car: [14, 6, (rect, c, lit) => {
        rect(4, 0, 6, 2, c)
        rect(5, 0, 2, 2, "#bcd3e8")
        rect(8, 0, 2, 2, "#bcd3e8")
        rect(1, 2, 13, 3, c)
        rect(13, 3, 1, 1, lit)
    }],
    taxi: [14, 7, (rect, c, lit) => {
        rect(6, 0, 2, 1, "#ffffff")
        rect(4, 1, 6, 2, "#f2c230")
        rect(5, 1, 2, 2, "#bcd3e8")
        rect(8, 1, 2, 2, "#bcd3e8")
        rect(1, 3, 13, 3, "#f2c230")
        rect(13, 4, 1, 1, lit)
    }],
    kei: [11, 7, (rect, c, lit) => {
        rect(1, 0, 9, 6, c)
        rect(7, 1, 3, 2, "#bcd3e8")
        rect(2, 1, 4, 2, "#bcd3e8")
        rect(10, 4, 1, 1, lit)
    }],
    bus: [30, 9, (rect, c, lit) => {
        rect(0, 0, 30, 8, "#f1f3f5")
        rect(0, 5, 30, 2, "#0a9a4a")
        for (let x = 2; x < 26; x += 4) rect(x, 1, 3, 3, "#bcd3e8")
        rect(27, 1, 3, 3, "#bcd3e8")
        rect(29, 6, 1, 1, lit)
    }],
    truck: [22, 9, (rect, c, lit) => {
        rect(0, 0, 15, 8, "#e8e4da")
        rect(2, 2, 10, 2, c)
        rect(16, 2, 6, 6, c)
        rect(18, 3, 3, 2, "#bcd3e8")
        rect(21, 6, 1, 1, lit)
    }],
    bike: [7, 8, (rect, c) => {
        rect(3, 0, 2, 2, "#e9c9a8")
        rect(3, 2, 2, 3, c)
        rect(1, 6, 2, 2, "#1a1a20")
        rect(5, 6, 2, 2, "#1a1a20")
        rect(2, 5, 4, 1, "#555a66")
    }],
    delivery: [10, 8, (rect, c, lit) => {
        rect(0, 1, 4, 4, "#e2231a")
        rect(0, 2, 4, 1, "#ffffff")
        rect(4, 0, 3, 2, "#e9c9a8")
        rect(4, 2, 2, 3, "#2a2f3a")
        rect(1, 5, 8, 2, "#d0d0d0")
        rect(9, 4, 1, 1, lit)
        rect(1, 7, 2, 1, "#14141c")
        rect(7, 7, 2, 1, "#14141c")
    }],
    scooter: [9, 8, (rect, c, lit) => {
        rect(3, 0, 3, 2, c)
        rect(3, 2, 2, 3, "#2a2f3a")
        rect(1, 5, 7, 2, c)
        rect(8, 4, 1, 1, lit)
    }],
}
const COATS = ["#3a4a6b", "#7a3b3b", "#2f5d50", "#5b4a7a", "#8a6d3b", "#444b55"]
const UMBRELLAS = ["#e2231a", "#1e64c8", "#f2c230", "#0a9a4a", "#f1f3f5", "#8e5bd8", "#ff7eb6"]

/** A walker on the pavement: legs alternate as they go, and an umbrella opens in the rain. */
function drawWalker(ctx, w, x, y, t, umbrella, dim) {
    const px = Math.round(x)
    const shade = (c) => (dim ? mix(c, "#0b1030", 0.35) : c)
    ctx.fillStyle = shade("#e9c9a8")
    ctx.fillRect(px + 1, y - 7, 2, 2)
    ctx.fillStyle = shade(w.coat)
    ctx.fillRect(px, y - 5, 4, 3)
    ctx.fillStyle = shade("#1a1a20")
    const stride = Math.floor(t * 5 + w.phase) % 2
    ctx.fillRect(px + (stride ? 0 : 1), y - 2, 1, 2)
    ctx.fillRect(px + (stride ? 3 : 2), y - 2, 1, 2)
    if (umbrella) {
        ctx.fillStyle = shade(w.umbrella)
        ctx.fillRect(px - 1, y - 10, 6, 1)
        ctx.fillRect(px - 2, y - 9, 8, 1)
        ctx.fillStyle = shade("#2a2f3a")
        ctx.fillRect(px + 2, y - 8, 1, 2)
    }
}

const CAR_COLORS = ["#c0392b", "#2c3e50", "#ecf0f1", "#2e86de", "#7f8c8d", "#16a085", "#8e44ad"]

function drawVehicle(ctx, v, x, y, lit) {
    const [w, h, draw] = VEHICLES[v.kind]
    const rect = (dx, dy, rw, rh, color) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(v.dir > 0 ? x + dx : x + w - dx - rw), y - h + dy, rw, rh)
    }
    draw(rect, v.color, lit ? "#fff4c2" : "#d8d2b8")
    ctx.globalAlpha = 0.35
    ctx.fillStyle = "#000000"
    ctx.fillRect(Math.round(x) + 1, y, w - 2, 1)
    ctx.globalAlpha = 1
    if (!["bike", "scooter", "delivery"].includes(v.kind)) {
        rect(2, h - 1, 3, 1, "#14141c")
        rect(w - 5, h - 1, 3, 1, "#14141c")
        rect(0, h - 3, 1, 1, "#ff4040")
    }
    if (lit && v.kind !== "bike") {
        // A short beam that fades out ahead of the vehicle.
        ctx.fillStyle = "#fff4c2"
        for (const [len, alpha] of [[4, 0.18], [8, 0.1], [12, 0.05]]) {
            ctx.globalAlpha = alpha
            ctx.fillRect(Math.round(v.dir > 0 ? x + w : x - len), y - 3, len, 2)
        }
        ctx.globalAlpha = 1
    }
}

/**
 * Starts the ride on `canvas`, with one station per element in `stops` (each needs
 * `dataset.line`). Returns `goTo(index)`, `setLook(look)` and `setWeather("clear" | "rain" |
 * "storm")`; `onStop(index)` fires when the nearest station changes.
 *
 * Pinned (wide screens): scrolling the tall `ride` drives the train and the panels ride with
 * their stations. `follow` (phones): the canvas is a strip above stops that read normally, and
 * `goTo(index)` just sends the train to that station.
 */
export function startRide({ ride, canvas, stops, look, onStop, follow = false }) {
    const ctx = canvas.getContext("2d")
    const stations = stops.map((el) => ({ line: el.dataset.line || LIVERY }))
    const legs = stations.length - 1 + DWELL
    if (!follow) ride.style.height = `${legs * SCROLL_PER_STOP * 100 + 100}vh`
    let followTarget = 0
    let extra = 0 // sky rows added above the scene on a portrait full-screen canvas

    let palette = PALETTES[look] ?? PALETTES.night
    let viewW = 0
    let scene
    let stars = []
    const shimmer = []
    const rain = []
    let weather = "clear" // "clear", "rain" or "storm", set from Jakarta's live weather
    let dark = false // lights on: 17:30 to 06:00 in Jakarta, or whenever it rains
    let lightsSince = -100 // when the lights last came on; lamps follow one by one
    const leaves = []
    const traffic = []
    const walkers = []
    const puddles = []
    const fireflies = []
    let lastMove = 0 // how far the camera moved last frame, for the train's sound
    const flocks = []
    let camera = 0
    let current = -1

    const resize = () => {
        // Landscape: the scene fills the height. Portrait (phones): fit ~300 scene pixels across,
        // keep the scene at the bottom, and extend the sky upward to fill the screen.
        const portrait = canvas.clientHeight > canvas.clientWidth
        viewW = portrait ? 300 : Math.ceil(canvas.clientWidth / (canvas.clientHeight / H))
        extra = portrait ? Math.max(0, Math.round(canvas.clientHeight / (canvas.clientWidth / viewW)) - H) : 0
        canvas.width = viewW
        canvas.height = H + extra
        ctx.imageSmoothingEnabled = false
        scene = buildLayers(palette, viewW, stations, seasonNow(), dark)
        const r = rng(3)
        stars = palette.stars ? Array.from({ length: Math.round(((viewW / 5) * (120 + extra)) / 120) }, () => ({ x: r() * viewW, y: r() * (120 + extra) - extra, phase: r() * 6 })) : []
        // Traffic spread along the whole street, both directions, and a few flocks of birds.
        walkers.length = 0
        puddles.length = 0
        fireflies.length = 0
        for (let i = 0; i < scene.layers.near.canvas.width / 45; i++) {
            walkers.push({
                x: r() * scene.layers.near.canvas.width,
                dir: r() < 0.5 ? 1 : -1,
                speed: 3 + r() * 4,
                phase: r() * 6,
                coat: COATS[Math.floor(r() * COATS.length)],
                umbrella: UMBRELLAS[Math.floor(r() * UMBRELLAS.length)],
            })
        }
        for (let i = 0; i < scene.layers.near.canvas.width / 60; i++) puddles.push({ x: r() * scene.layers.near.canvas.width, w: 8 + r() * 10, phase: r() * 6 })
        for (let i = 0; i < 26; i++) fireflies.push({ x: r() * viewW, y: 178 + r() * 55, phase: r() * 6 })
        traffic.length = 0
        const kinds = ["car", "car", "car", "taxi", "kei", "kei", "bus", "truck", "bike", "bike", "scooter"]
        const street = scene.layers.near.canvas.width
        for (let i = 0; i < Math.round(street / 70); i++) {
            const kind = kinds[Math.floor(r() * kinds.length)]
            const slow = kind === "bike" ? 8 : kind === "scooter" ? 16 : 22
            traffic.push({ kind, x: r() * street, dir: r() < 0.5 ? 1 : -1, speed: slow + r() * 10, color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] })
        }
        flocks.length = 0
        for (let i = 0; i < 3; i++) {
            flocks.push({
                x: r() * viewW,
                y: 25 + r() * 70,
                speed: 6 + r() * 6,
                birds: Array.from({ length: 3 + Math.floor(r() * 4) }, (_, k) => ({ dx: -k * 6 + r() * 3, dy: Math.abs(k - 2) * 3 + r() * 2, phase: r() * 6 })),
            })
        }
        leaves.length = 0
        const drifting = { spring: 60, summer: 18, autumn: 60, winter: 90 }[scene.season]
        for (let i = 0; i < drifting; i++) leaves.push({ x: r() * viewW, y: r() * RIVER, fall: 8 + r() * 14, wind: 14 + r() * 24, phase: r() * 6 })
        rain.length = 0
        for (let i = 0; i < viewW / 2.5; i++) rain.push({ x: r() * viewW, y: r() * H, speed: 140 + r() * 60 })
        shimmer.length = 0
        for (let i = 0; i < viewW / 6; i++) shimmer.push({ x: r() * viewW, y: RIVER + 2 + r() * (H - RIVER - 3), w: 2 + r() * 5, phase: r() * 6 })
    }

    /** Scroll progress to camera: travel between stations, easing in and dwelling at each. */
    const targetCamera = () => {
        if (follow) return followTarget
        const top = ride.offsetTop
        const total = ride.offsetHeight - innerHeight
        const u = clamp((scrollY - top) / total) * legs
        const leg = Math.floor(u)
        if (leg >= stations.length - 1) return (stations.length - 1) * SPACING
        return (leg + smooth(clamp((u - leg - DWELL) / (1 - DWELL)))) * SPACING
    }

    /**
     * Street lamps lit from dawn to dusk: a soft halo around each head ("halo", drawn over the
     * town) and a pool of light on the street ("pool", drawn over the track layer's street).
     * A few old lamps flicker.
     */
    const drawLampGlow = (offset, t, part) => {
        for (const lamp of scene.lamps) {
            const x = lamp.x - offset
            if (x < -16 || x > viewW + 16) continue
            if (t - lightsSince < lamp.phase * 0.5) continue // still switching on down the street
            const on = lamp.flicker && Math.sin(t * 13 + lamp.phase) * Math.sin(t * 3.1 + lamp.phase) > 0.6 ? 0.25 : 1
            ctx.save()
            if (part === "halo") {
                ctx.translate(x + 0.5, TOWN - 12.5)
            } else {
                ctx.translate(x + 0.5, TOWN + 2)
                ctx.scale(2.4, 0.45)
            }
            const radius = part === "halo" ? 9 : 7
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
            glow.addColorStop(0, palette.glow)
            glow.addColorStop(1, "transparent")
            ctx.globalAlpha = (part === "halo" ? 0.45 : 0.35) * on
            ctx.fillStyle = glow
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
            ctx.restore()
        }
    }

    /** Birds by day, a plane with a blinking light by night, crossing the far sky. */
    const drawSky = (t) => {
        const span = viewW + 60
        if (palette.stars) {
            const x = ((t * 9) % (span * 2)) - 30
            if (x < span) {
                ctx.fillStyle = mix(palette.sky[0], "#ffffff", 0.35)
                ctx.fillRect(Math.round(x), 22, 5, 1)
                ctx.fillRect(Math.round(x) + 2, 21, 1, 3)
                if (Math.floor(t * 1.5) % 2) {
                    ctx.fillStyle = "#ff3b3b"
                    ctx.fillRect(Math.round(x) + 4, 22, 1, 1)
                }
            }
            return
        }
        ctx.fillStyle = mix(palette.near, "#000000", 0.3)
        for (const flock of flocks) {
            const fx = ((flock.x + t * flock.speed) % span) - 30
            for (const bird of flock.birds) {
                const bx = Math.round(fx + bird.dx)
                const by = Math.round(flock.y + bird.dy + Math.sin(t * 0.8 + bird.phase) * 1.5)
                const up = Math.sin(t * 9 + bird.phase) > 0
                ctx.fillRect(bx - 1, by - (up ? 1 : 0), 1, 1)
                ctx.fillRect(bx, by, 1, 1)
                ctx.fillRect(bx + 1, by - (up ? 1 : 0), 1, 1)
            }
        }
    }

    const frame = (now) => {
        const raining = weather !== "clear"
        const target = targetCamera()
        const speed = target - camera
        lastMove = speed * (follow ? 0.35 : 0.14) // tighter when following a swipe
        camera += lastMove
        if (Math.abs(speed) < 0.05) camera = target
        const t = now / 1000

        // Everything below draws in scene coordinates, shifted down under the extended sky.
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = palette.sky[0]
        ctx.fillRect(0, 0, viewW, extra)
        ctx.setTransform(1, 0, 0, 1, 0, extra)
        ctx.drawImage(scene.sky.canvas, 0, 0)
        for (const s of raining ? [] : stars) {
            ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.phase))
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1)
        }
        ctx.globalAlpha = 1
        for (const [name, layerSpeed] of LAYERS) {
            ctx.drawImage(scene.layers[name].canvas, Math.round(camera * layerSpeed), 0, viewW, H, 0, 0, viewW, H)
            if (name === "far" && !raining) drawSky(t)
            if (name === "near") {
                const offset = Math.round(camera * layerSpeed)
                drawTrees(ctx, scene, offset, viewW, t)
                drawCats(ctx, scene, offset, viewW, t)
                const span = scene.layers.near.canvas.width
                const wrap = (v) => ((v % span) + span) % span - offset
                // Rain puddles on the street, catching the sky by day and lamp light by night.
                if (raining) {
                    for (const pd of puddles) {
                        const x = Math.round(wrap(pd.x))
                        if (x < -20 || x > viewW) continue
                        ctx.fillStyle = mix(palette.ground, dark ? palette.glow : palette.sky[1], 0.3)
                        ctx.fillRect(x, TOWN + 6, Math.round(pd.w), 1)
                        ctx.fillRect(x + 2, TOWN + 7, Math.round(pd.w) - 4, 1)
                        ctx.fillStyle = mix(palette.ground, "#ffffff", 0.45)
                        ctx.fillRect(x + Math.round((Math.sin(t * 3 + pd.phase) * 0.5 + 0.5) * (pd.w - 2)), TOWN + 6, 1, 1)
                    }
                }
                // Steam rising from the ramen stalls; thicker in the cold of winter.
                ctx.fillStyle = "#e8e8f0"
                for (const st of scene.stalls) {
                    const x = st.x - offset
                    if (x < -10 || x > viewW + 10) continue
                    for (let k = 0; k < 4; k++) {
                        const rise = (t * 5 + k * 3.5 + st.x) % 14
                        ctx.globalAlpha = (scene.season === "winter" ? 0.55 : 0.3) * (1 - rise / 14)
                        ctx.fillRect(Math.round(x + Math.sin(t * 1.5 + k * 2) * 2), Math.round(st.y - rise), k % 2 ? 2 : 1, 1)
                    }
                }
                ctx.globalAlpha = 1
                // People on the pavement, under umbrellas when it rains.
                for (const w of walkers) {
                    const x = wrap(w.x + w.dir * w.speed * t)
                    if (x > -10 && x < viewW + 10) drawWalker(ctx, w, x, TOWN + 1, t, raining, dark)
                }
                // A delivery scooter riding konbini to konbini, stopping at each for a moment.
                if (scene.konbini.length) {
                    const stops = [...scene.konbini, scene.konbini[0] + span]
                    const legs = stops.slice(1).map((to, i) => to - stops[i])
                    const cycle = legs.reduce((sum, d) => sum + d / 20 + 4, 0)
                    let left = t % cycle
                    let at = stops[0]
                    for (const d of legs) {
                        if (left < 4) break
                        left -= 4
                        if (left < d / 20) {
                            at += left * 20
                            break
                        }
                        left -= d / 20
                        at += d
                    }
                    const x = wrap(at - 5)
                    if (x > -12 && x < viewW + 12) drawVehicle(ctx, { kind: "delivery", dir: 1, color: "#e2231a" }, x, TOWN + 4, dark)
                }
                const street = scene.layers.near.canvas.width
                const lit = dark
                for (const v of traffic) {
                    const wx = (((v.x + v.dir * v.speed * t) % street) + street) % street
                    const x = wx - offset
                    if (x > -40 && x < viewW + 10) drawVehicle(ctx, v, x, v.dir > 0 ? TOWN + 8 : TOWN + 4, lit)
                }
                if (dark) {
                    drawLampGlow(offset, t, "halo")
                    // Ramen lanterns glow at night.
                    ctx.save()
                    ctx.globalCompositeOperation = "screen"
                    for (const st of scene.stalls)
                        for (const lx of st.lanterns) {
                            const x = lx - offset
                            if (x < -8 || x > viewW + 8) continue
                            const g = ctx.createRadialGradient(x, st.ly, 0, x, st.ly, 5)
                            g.addColorStop(0, "rgba(255, 74, 58, 0.5)")
                            g.addColorStop(1, "rgba(255, 74, 58, 0)")
                            ctx.fillStyle = g
                            ctx.fillRect(x - 5, st.ly - 5, 10, 10)
                        }
                    ctx.restore()
                }
            }
            if (name === "track" && dark) drawLampGlow(Math.round(camera * 0.65), t, "pool")
        }
        // Leaves, petals or snow falling across the whole scene, pushed left by the wind and
        // fluttering as they fall; the train's motion sweeps them past faster.
        const snowing = scene.season === "winter"
        for (const leaf of raining ? [] : leaves) {
            const span = viewW + 20
            const x = (((leaf.x - t * leaf.wind * (snowing ? 0.35 : 1) - camera * 0.65 + Math.sin(t * 1.3 + leaf.phase) * 4) % span) + span) % span - 10
            const y = ((leaf.y + t * leaf.fall) % (RIVER + extra)) - extra
            const [px, py] = [Math.round(x), Math.round(y)]
            if (snowing) {
                ctx.fillStyle = scene.drift
                ctx.fillRect(px, py, leaf.wind > 30 ? 2 : 1, 1)
            } else if (Math.sin(t * 5 + leaf.phase * 3) > 0) {
                ctx.fillStyle = scene.drift
                ctx.fillRect(px, py, 2, 1)
                ctx.fillStyle = scene.driftDark
                ctx.fillRect(px + 1, py + 1, 1, 1)
            } else {
                ctx.fillStyle = scene.drift
                ctx.fillRect(px, py, 1, 2)
                ctx.fillStyle = scene.driftDark
                ctx.fillRect(px + 1, py, 1, 1)
            }
        }
        const moving = Math.abs(speed) > 0.5
        const trainLamps = drawTrain(ctx, palette, Math.round(viewW / 2), moving && Math.floor(t * 8) % 2 ? 1 : 0, dark)

        // The river mirrors the bridge and train above it, then ripples and shimmers.
        const depth = H - RIVER
        ctx.save()
        ctx.translate(0, 2 * RIVER)
        ctx.scale(1, -1)
        ctx.globalAlpha = 0.5
        ctx.drawImage(canvas, 0, RIVER - depth + extra, viewW, depth, 0, RIVER - depth, viewW, depth)
        ctx.restore()
        ctx.globalAlpha = 0.45
        ctx.fillStyle = scene.river
        ctx.fillRect(0, RIVER, viewW, depth)
        ctx.globalAlpha = 1
        ctx.fillStyle = mix(scene.river, palette.glow, 0.4)
        for (const s of shimmer) if (Math.sin(t * 2 + s.phase) > 0.6) ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.w), 1)
        ctx.fillStyle = mix(scene.deck, "#000000", 0.2)
        for (let x = 40 - (Math.round(camera) % 120); x < viewW; x += 120) ctx.fillRect(x, RIVER, 7, depth)

        // Rain: a grey veil over everything, slanted streaks, splashes on the river, and in a
        // storm an occasional double flash of lightning.
        if (raining) {
            ctx.globalAlpha = 0.28
            ctx.fillStyle = "#1a2030"
            ctx.fillRect(0, -extra, viewW, H + extra)
            ctx.globalAlpha = 0.5
            ctx.fillStyle = mix(palette.sky[1], "#ffffff", 0.55)
            for (const drop of rain) {
                const y = ((drop.y + t * drop.speed) % (H + extra)) - extra
                const x = (((drop.x - y * 0.25 - camera * 0.3) % viewW) + viewW) % viewW
                ctx.fillRect(Math.round(x), Math.round(y), 1, 4)
            }
            ctx.globalAlpha = 1
            for (const s of shimmer) if (Math.sin(t * 7 + s.phase * 5) > 0.85) ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 2)
            const beat = t % 11
            if (weather === "storm" && (beat < 0.07 || (beat > 0.18 && beat < 0.24))) {
                ctx.globalAlpha = 0.35
                ctx.fillStyle = "#ffffff"
                ctx.fillRect(0, -extra, viewW, H + extra)
                ctx.globalAlpha = 1
            }
        }

        if (dark) drawTrainLights(ctx, trainLamps)
        if (dark && !raining && scene.season === "summer") {
            ctx.save()
            ctx.globalCompositeOperation = "screen"
            for (const f of fireflies) {
                const glow = Math.sin(t * 2.2 + f.phase * 3)
                if (glow < 0.2) continue
                const x = f.x + Math.sin(t * 0.7 + f.phase) * 10
                const y = f.y + Math.cos(t * 0.9 + f.phase) * 4
                ctx.globalAlpha = glow
                ctx.fillStyle = "#d8ff6a"
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
                ctx.globalAlpha = glow * 0.3
                ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3)
            }
            ctx.restore()
        }

        // Each stop's panel rides with its station and fades as it leaves (pinned only).
        const pxPerScene = canvas.clientHeight / H
        let nearest = 0
        if (!follow) stops.forEach((el, i) => {
            const offset = (i * SPACING - camera) * pxPerScene
            const opacity = clamp(1 - Math.abs(offset) / (innerWidth * 0.5))
            el.style.transform = `translate3d(${offset.toFixed(1)}px, 0, 0)`
            el.style.opacity = opacity.toFixed(3)
            el.style.visibility = opacity > 0 ? "visible" : "hidden"
            el.inert = opacity < 0.6
            if (Math.abs(i * SPACING - camera) < Math.abs(nearest * SPACING - camera)) nearest = i
        })
        if (!follow && nearest !== current) {
            current = nearest
            onStop?.(current)
        }
        requestAnimationFrame(frame)
    }

    let resizeTimer
    addEventListener("resize", () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(resize, 150)
    })
    resize()
    camera = targetCamera()
    requestAnimationFrame(frame)

    /** Re-checks whether the lights should be on; rebuilds the scenery only when that changes. */
    const checkLights = (animate = true) => {
        const [hour, minute] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .format(new Date())
            .split(":")
            .map(Number)
        const time = hour + minute / 60
        const next = time >= 17.5 || time < 6 || weather !== "clear"
        if (next === dark) return
        dark = next
        if (dark && animate) lightsSince = performance.now() / 1000
        resize()
    }
    checkLights(false)
    setInterval(checkLights, 60_000)

    return {
        goTo(index) {
            if (follow) {
                followTarget = index * SPACING // fractional while a swipe is in progress
                return
            }
            const top = ride.offsetTop
            const total = ride.offsetHeight - innerHeight
            scrollTo({ top: top + ((index + DWELL / 2) / legs) * total, behavior: "smooth" })
        },
        /** Camera movement last frame and the weather, for sound. */
        state() {
            return { move: lastMove, weather }
        },
        setWeather(next) {
            weather = next
            checkLights()
        },
        setLook(next) {
            if (PALETTES[next] === palette) return
            palette = PALETTES[next] ?? PALETTES.night
            resize()
        },
    }
}
