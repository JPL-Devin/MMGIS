import { observationFor, resolveApiUrl } from './logic'

const FieldObsAdd = {
    async use(ctx) {
        const observation = observationFor(ctx)
        if (observation == null) return

        const url = resolveApiUrl(
            (ctx.config || {}).endpoint,
            window.mmgisglobal?.ROOT_PATH
        )

        try {
            const res = await window.fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(observation),
            })
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
            ctx.state.fieldObsAdded = observation
        } catch (err) {
            console.warn('FieldObsAdd: could not write observation', err)
            return
        }

        // The supported way to get what we just wrote onto the map: the layer
        // re-acquires through its own `source.fetch` (trigger 'refresh').
        await ctx.refreshLayer()
    },
}

export default FieldObsAdd
