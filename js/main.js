// Builds one stop per part of the story from data/*.json, then either runs the ride (wide
// screens, motion allowed) or lets the stops read top to bottom. The look follows the hour
// in Jakarta, the same way the lofi city does.

import { startRide } from "./ride.js"
import { createSound } from "./sound.js"

const TIME_ZONE = "Asia/Jakarta"
const LOOK_ICONS = { dawn: "☀", day: "☀", dusk: "☾", night: "☾" }
const LINES = ["#0a9a4a", "#e2231a", "#f58220", "#1e64c8", "#8e5bd8", "#00a7a7"]
const LINKS = {
    github: "https://github.com/geshtng",
    linkedin: "https://linkedin.com/in/gerald-sihotang",
    email: "mailto:geraldsihotang@hotmail.com",
}

const $ = (id) => document.getElementById(id)
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const rideOn = document.documentElement.classList.contains("ride-on")
const rideMini = document.documentElement.classList.contains("ride-mini")

const timeOfDay = (hour) =>
    hour >= 4 && hour < 6 ? "dawn" : hour >= 6 && hour < 16 ? "day" : hour >= 16 && hour < 19 ? "dusk" : "night"

async function load(name) {
    const response = await fetch(`data/${name}.json`)
    if (!response.ok) throw new Error(`data/${name}.json: ${response.status}`)
    return response.json()
}

const chips = (tools) => `<div class="chips">${(tools ?? []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>`
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}" /></svg>`
const contactLinks = `
    <div class="contact">
        <a class="btn" href="${LINKS.github}" target="_blank" rel="noopener">${icon("github")} GitHub</a>
        <a class="btn" href="${LINKS.linkedin}" target="_blank" rel="noopener">${icon("linkedin")} LinkedIn</a>
        <a class="btn" href="${LINKS.email}">${icon("mail")} Email</a>
    </div>`

/** Every stop on the line, in riding order: me, each job newest first, school, projects, contact. */
function buildStops({ jobs, schools, projects }) {
    const stops = []
    // Whole-career stats, worked out from the data so they stay true as jobs are added.
    const firstJob = jobs.at(-1)?.date.match(/\d{4}/)?.[0]
    const years = firstJob ? new Date().getFullYear() - Number(firstJob) : null

    stops.push({
        id: "about",
        label: "About",
        kana: "ジェラルド・シホタン",
        name: "Gerald Sihotang",
        sub: "Software Engineer · Jakarta",
        body: `
            <div class="intro">
                <img class="portrait" src="assets/PP.jpg" alt="Gerald Sihotang" width="112" height="120">
                <p class="lead">I build the behind-the-scenes systems that keep apps fast and dependable. Over the years that's meant rewards at Tokopedia, keeping Shopee's services healthy at Sea Labs, and backend services at Mekari, and I like making slow things quick wherever I go.</p>
            </div>
            <ul class="stats">
                ${years ? `<li><b>${years} yrs</b> building software</li>` : ""}
                <li><b>Jakarta</b> home base</li>
                <li><b>Games</b> off the clock</li>
            </ul>
            <p class="now"><span class="tag">NOW</span> Software engineer at Mekari.</p>`,
    })

    for (const [i, job] of jobs.entries()) {
        const now = /present/i.test(job.date)
        stops.push({
            id: `job-${i + 1}`,
            label: job.company,
            name: job.company,
            sub: job.title,
            body: `
                <p class="meta">${esc(job.date)}${now ? ' <span class="tag blink">NOW</span>' : ""} · ${esc(job.location)}</p>
                <ul class="points">${(job.highlights ?? job.description_details).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`,
        })
    }

    for (const school of schools) {
        stops.push({
            id: "origin",
            label: "Origin",
            kana: "始発",
            name: school.institution,
            sub: `${school.degree} · ${school.date}`,
            body: `
                <p class="meta">${esc(school.major)} · ${esc(school.location)}</p>
                ${school.description ? `<p>${esc(school.description)}</p>` : ""}
`,
        })
    }

    const featured = projects.find((p) => p.title === "git-lofi")
    const others = projects.filter((p) => p !== featured)
    stops.push({
        id: "projects",
        label: "Projects",
        kana: "作品",
        name: "Projects",
        sub: "Things I've built",
        body: `
            ${featured ? `
            <div class="featured">
                <img src="https://raw.githubusercontent.com/geshtng/geshtng/lofi/lofi.gif" alt="The live git-lofi city" loading="lazy">
                <div>
                    <h3><a href="${esc(featured.repository)}" target="_blank" rel="noopener">${esc(featured.title)}</a></h3>
                    <p>${esc(featured.description)}</p>
                    ${chips(featured.tools)}
                </div>
            </div>` : ""}
            ${others.map((p) => `
            <div class="project">
                <h3><a href="${esc(p.repository)}" target="_blank" rel="noopener">${esc(p.title)}</a>
                    ${p.demo ? `<a class="small" href="${esc(p.demo)}" target="_blank" rel="noopener">demo →</a>` : ""}</h3>
                <p>${esc(p.description)}</p>
                ${chips(p.tools)}
            </div>`).join("")}
            <p class="meta">More on <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub</a>.</p>`,
    })

    stops.push({
        id: "hi",
        label: "Say hi",
        kana: "終点",
        name: "Say hi",
        sub: "End of the line",
        body: `
            <p class="lead">Thanks for riding. Want to talk? My inbox is open.</p>
            ${contactLinks}`,
    })

    return stops.map((stop, i) => ({ ...stop, line: LINES[i % LINES.length] }))
}

const stopHtml = (stop, i, stops) => `
    <article class="stop" id="stop-${stop.id}" data-line="${stop.line}" style="--line:${stop.line}" aria-label="${esc(stop.label)}">
        <header class="sign">
            <span class="sign-number">${String(i + 1).padStart(2, "0")}</span>
            ${stop.kana ? `<p class="sign-kana" lang="ja">${esc(stop.kana)}</p>` : ""}
            <${i === 0 ? "h1" : "h2"} class="sign-name">${esc(stop.name)}</${i === 0 ? "h1" : "h2"}>
            <p class="sign-sub">${esc(stop.sub)}</p>
            <div class="sign-stripe"></div>
            <p class="sign-next">
                ${i > 0 ? `<a href="#stop-${stops[i - 1].id}">← ${esc(stops[i - 1].label)}</a>` : "<span></span>"}
                ${i + 1 < stops.length ? `<a href="#stop-${stops[i + 1].id}">${esc(stops[i + 1].label)} →</a>` : `<span lang="ja">終点</span>`}
            </p>
        </header>
        <div class="stop-body">${stop.body}</div>
    </article>`

function updateTime(ride) {
    const now = new Date()
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now))
    const look = timeOfDay(hour)
    document.documentElement.dataset.time = look
    $("clock-look").textContent = LOOK_ICONS[look]
    $("clock-time").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(now)
    ride?.setLook(look)
}

/**
 * Jakarta's current weather from Open-Meteo (free, no key): "rain" for drizzle, rain or
 * showers, "storm" for thunderstorms, otherwise "clear". Cached for 20 minutes per visitor;
 * any failure just means clear skies.
 */
async function jakartaWeather() {
    const KEY = "jakarta-weather"
    try {
        const cached = JSON.parse(sessionStorage.getItem(KEY))
        if (cached && Date.now() - cached.at < 20 * 60_000) return cached.kind
    } catch {}
    try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&current=weather_code", { signal: AbortSignal.timeout(5000) })
        const code = (await response.json()).current.weather_code
        const kind = code >= 95 ? "storm" : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? "rain" : "clear"
        try {
            sessionStorage.setItem(KEY, JSON.stringify({ kind, at: Date.now() }))
        } catch {}
        return kind
    } catch {
        return "clear"
    }
}

function markStop(stops, index) {
    document.querySelectorAll(".route-dot").forEach((dot, i) => dot.classList.toggle("active", i === index))
    $("route-now").textContent = stops[index].label
    $("ride-hint").classList.toggle("gone", index > 0)
}

async function main() {
    $("current-year").textContent = new Date().getFullYear()
    const [jobs, schools, projects] = await Promise.all([load("experiences"), load("educations"), load("projects")])
    const stops = buildStops({ jobs, schools, projects })
    $("stops").innerHTML = stops.map(stopHtml).join("")
    $("route").innerHTML = stops
        .map((s, i) => `<li><a class="route-dot" href="#stop-${s.id}" style="--line:${s.line}" title="${esc(s.label)}"><span class="sr-only">${esc(s.label)}</span></a></li>`)
        .join("")

    let ride = null
    if (rideOn) {
        ride = startRide({
            ride: $("ride"),
            canvas: $("scene"),
            stops: [...document.querySelectorAll(".stop")],
            look: document.documentElement.dataset.time,
            onStop: (i) => markStop(stops, i),
        })
        document.addEventListener("click", (event) => {
            const link = event.target.closest('a[href^="#stop-"]')
            if (!link) return
            event.preventDefault()
            ride.goTo(Math.max(stops.findIndex((s) => `#stop-${s.id}` === link.hash), 0))
        })
    } else if (rideMini) {
        // Phones: swipe through the stations as cards; the train rides to the one in view.
        ride = startRide({ ride: $("ride"), canvas: $("scene"), stops: [...document.querySelectorAll(".stop")], look: document.documentElement.dataset.time, follow: true })
        const track = $("stops")
        const cards = [...track.children]
        $("ride-hint").textContent = "Swipe to ride the line →"
        let shown = -1
        const onSwipe = () => {
            // Where the swipe is, in stations (fractional while dragging): the scenery slides
            // with the finger, each layer at its own speed, and settles when the card snaps.
            const stride = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1
            const position = Math.min(Math.max(track.scrollLeft / stride, 0), cards.length - 1)
            ride.goTo(position)
            const index = Math.round(position)
            if (index === shown) return
            shown = index
            markStop(stops, index)
        }
        track.addEventListener("scroll", onSwipe, { passive: true })
        document.addEventListener("click", (event) => {
            const link = event.target.closest('a[href^="#stop-"]')
            if (!link) return
            event.preventDefault()
            document.querySelector(link.hash)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
        })
        onSwipe()
    } else {
        // Reading layout (reduced motion): stops in a column, the city GIF on top.
        const observer = new IntersectionObserver(
            (entries) =>
                entries.forEach((e) => {
                    if (!e.isIntersecting) return
                    const index = [...$("stops").children].indexOf(e.target)
                    markStop(stops, index)
                }),
            { rootMargin: "-55% 0px -40% 0px" },
        )
        document.querySelectorAll(".stop").forEach((el) => observer.observe(el))
        markStop(stops, 0)
    }

    updateTime(ride)
    setInterval(() => updateTime(ride), 30_000)
    if (ride) {
        // Sound: off until the visitor asks; chime when the train comes to rest at a station.
        const sound = createSound()
        const button = $("sound")
        button.hidden = false
        button.addEventListener("click", () => {
            const on = sound.toggle()
            button.setAttribute("aria-pressed", String(on))
            button.textContent = on ? "♪ on" : "♪ off"
        })
        let moving = false
        setInterval(() => {
            const state = ride.state()
            sound.update(state)
            if (moving && Math.abs(state.move) < 0.05) sound.chime()
            moving = Math.abs(state.move) > 1
        }, 100)

        const updateWeather = async () => ride.setWeather(await jakartaWeather())
        updateWeather()
        setInterval(updateWeather, 20 * 60_000)
    }

    // ponytail: switching between ride and reading layouts reloads; live re-layout isn't worth the code
    for (const query of ["(min-width: 900px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)", "(prefers-reduced-motion: reduce)"])
        matchMedia(query).addEventListener("change", () => location.reload())
}

main().catch((error) => {
    // The static fallback in index.html stays; show it top to bottom instead of on the ride.
    console.error(error)
    document.documentElement.classList.remove("ride-on")
})
