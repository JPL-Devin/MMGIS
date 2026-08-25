export function getSettingsPresentation(isMobile, isNarrow) {
    return isMobile || isNarrow ? 'page' : 'drawer'
}
