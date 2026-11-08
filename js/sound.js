// Ride sounds, synthesized with Web Audio so there are no files to load: a low train hum that
// rises with speed, rain when Jakarta is wet, and a two-note chime on arriving at a station.
// Silent until the visitor turns it on; browsers only allow audio after a click anyway.

export function createSound() {
    let ctx
    let humGain
    let hum
    let rainGain
    let on = false

    const start = () => {
        ctx = new AudioContext()
        const master = ctx.createGain()
        master.gain.value = 0.5
        master.connect(ctx.destination)

        const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
        const samples = noise.getChannelData(0)
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
        const loop = () => {
            const source = ctx.createBufferSource()
            source.buffer = noise
            source.loop = true
            source.start()
            return source
        }

        // The hum: rumbling low-passed noise under a soft low tone.
        humGain = ctx.createGain()
        humGain.gain.value = 0
        humGain.connect(master)
        const rumble = ctx.createBiquadFilter()
        rumble.type = "lowpass"
        rumble.frequency.value = 160
        loop().connect(rumble).connect(humGain)
        hum = ctx.createOscillator()
        hum.frequency.value = 48
        const tone = ctx.createGain()
        tone.gain.value = 0.2
        hum.connect(tone).connect(humGain)
        hum.start()

        // Rain: high-passed noise.
        rainGain = ctx.createGain()
        rainGain.gain.value = 0
        rainGain.connect(master)
        const hiss = ctx.createBiquadFilter()
        hiss.type = "highpass"
        hiss.frequency.value = 1400
        loop().connect(hiss).connect(rainGain)
    }

    return {
        get on() {
            return on
        },
        toggle() {
            if (!ctx) start()
            on = !on
            if (on) ctx.resume()
            else ctx.suspend()
            return on
        },
        /** `move` is how far the train moved last frame; `weather` is "clear", "rain" or "storm". */
        update({ move, weather }) {
            if (!on) return
            const now = ctx.currentTime
            const speed = Math.min(Math.abs(move) / 6, 1)
            humGain.gain.setTargetAtTime(0.06 + speed * 0.3, now, 0.4)
            hum.frequency.setTargetAtTime(44 + speed * 30, now, 0.4)
            rainGain.gain.setTargetAtTime(weather === "clear" ? 0 : weather === "storm" ? 0.16 : 0.1, now, 1.5)
        },
        /** A soft two-note station chime. */
        chime() {
            if (!on) return
            const now = ctx.currentTime
            ;[[659.25, 0], [523.25, 0.35]].forEach(([frequency, delay]) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.value = frequency
                gain.gain.setValueAtTime(0, now + delay)
                gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.2)
                osc.connect(gain).connect(ctx.destination)
                osc.start(now + delay)
                osc.stop(now + delay + 1.3)
            })
        },
    }
}
