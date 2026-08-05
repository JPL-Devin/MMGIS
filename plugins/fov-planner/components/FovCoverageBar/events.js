/**
 * The name of the CustomEvent the FovInspect interaction dispatches on
 * `document` and this component listens for.
 *
 * Duplicated from ../../interactions/FovInspect/logic.js on purpose: that
 * module is reachable, but importing anything out of the interaction's
 * directory risks pulling its handler's `@basics` aliases into the component's
 * chunk, and core defines no shared constant for a plugin-to-plugin channel.
 */
export const REPORT_EVENT = 'fov-planner:report'
