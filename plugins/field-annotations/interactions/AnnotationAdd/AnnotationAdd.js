import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

// Cross-family import: the interaction reuses the layertype's url helper so
// both families agree on where the backend plugin lives.
import { apiUrl, buildAnnotationBody } from '../../layertypes/Annotation/lib/pure'

const AnnotationAdd = {
    async use(ctx) {
        // A click on an existing annotation should read, not create another.
        if (ctx.feature) return
        const latlng = ctx.event?.latlng
        if (!latlng) return

        const { promptText = 'Annotation note:' } = ctx.config || {}
        const note = window.prompt(promptText)
        if (note == null || note.trim() === '') return

        const body = buildAnnotationBody(
            latlng,
            note.trim(),
            L_.mission || window.mmgisglobal?.mission
        )

        try {
            const url = apiUrl('/add', window.mmgisglobal?.ROOT_PATH || '')
            const res = await window.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
            ctx.state.annotationAdded = body

            // Make it show up: re-fetch every annotation layer on the map.
            Object.keys(L_.layers.data || {}).forEach((name) => {
                const layerData = L_.layers.data[name]
                if (layerData?.type === 'annotation')
                    Map_.refreshLayer(layerData)
            })
        } catch (err) {
            console.warn(`AnnotationAdd failed: ${err?.message || err}`)
        }
    },
}

export default AnnotationAdd
