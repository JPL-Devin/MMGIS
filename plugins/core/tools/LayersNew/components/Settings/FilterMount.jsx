import React, { useEffect, useRef } from 'react'

function FilterMount({ adapter, layerName }) {
    const ref = useRef(null)

    useEffect(() => {
        if (!ref.current) return undefined
        adapter.mountFilter(ref.current, layerName)
        return () => adapter.destroyFilter()
    }, [adapter, layerName])

    return <div className='layersNewTool_filterMount' ref={ref} />
}

export default FilterMount
