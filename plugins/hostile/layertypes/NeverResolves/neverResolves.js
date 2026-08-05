function fetch() {
    return new Promise(() => {})
}

const NeverResolves = { source: { fetch } }

export default NeverResolves
