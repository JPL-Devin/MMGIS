function make(layerObj) {
    throw new Error(`BrokenType.make: deliberate failure for ${layerObj.name}`)
}

function destroy() {}

const BrokenType = { make, destroy }

export default BrokenType
