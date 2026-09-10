import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Login from '../Basics/UserInterface_/components/Login/Login'
import Button from '../../design-system/components/Button/Button'
import IconButton from '../../design-system/components/IconButton/IconButton'
import Tooltip from '../../design-system/components/Tooltip/Tooltip'

export const DOCS_URL = 'https://nasa-ammos.github.io/MMGIS/'
const ABOUT_URL = 'https://github.com/NASA-AMMOS/MMGIS'
const MMGIS_LOGO_URL = 'public/images/logos/mmgis.png'

// Admin-selectable preset colors for the card body dot
export const DOT_COLORS = {
    red: '#e5484d',
    orange: '#f0883e',
    yellow: '#e2b53e',
    green: '#3fb27f',
    teal: '#2aa8a0',
    blue: '#4a8fe7',
    purple: '#9b6be8',
    gray: '#8b9299',
}

export function getCardFields(missionName, missionsMeta) {
    const meta = missionsMeta[missionName]
    const look = (meta && meta.config && meta.config.look) || {}
    const card = look.card || {}
    const str = (v) => (typeof v === 'string' && v.trim() ? v : null)
    return {
        title: str(look.missionname) || missionName,
        color: str(card.color),
        imageurl: str(card.imageurl)
            ? resolveImageUrl(card.imageurl, missionName)
            : null,
        subtext: str(card.subtext),
        description: str(card.description),
        body: str(card.body),
        dotColor: DOT_COLORS[card.dotColor] || null,
        archived: card.archived === true,
    }
}

function resolveImageUrl(url, missionName) {
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    if (url.startsWith('public/') || url.startsWith('/')) return url
    return 'Missions/' + missionName + '/' + url
}

function getLandingOptions() {
    const o =
        (window.mmgisglobal.options &&
            window.mmgisglobal.options.landingPage) ||
        {}
    const bg = typeof o.backgroundImageUrl === 'string' ? o.backgroundImageUrl.trim() : ''
    return {
        theme: o.theme === 'dark' ? 'dark' : 'light',
        backgroundImageUrl: bg || null,
        hideArchived: o.hideArchived === true || o.hideArchived === 'true',
    }
}

// Strong base color with opposing radial highlights and a glassy sheen
function gradientFor(color) {
    const light = 'color-mix(in srgb, ' + color + ' 45%, #ffffff)'
    const dark = 'color-mix(in srgb, ' + color + ' 70%, #000000)'
    return [
        'linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0) 60%)',
        'radial-gradient(circle at 0% 0%, ' + light + ' 0%, transparent 55%)',
        'radial-gradient(circle at 100% 100%, ' + dark + ' 0%, transparent 60%)',
        'linear-gradient(135deg, ' + color + ' 0%, ' + color + ' 100%)',
    ].join(', ')
}

function useCurrentUser() {
    const read = () => {
        const u = window.mmgisglobal.user
        return u != null && u !== 'guest' && u !== '' ? String(u) : null
    }
    const [user, setUser] = useState(read)
    useEffect(() => {
        const update = () => setUser(read())
        document.addEventListener('mmgis:loginchange', update)
        return () => document.removeEventListener('mmgis:loginchange', update)
    }, [])
    return [user, () => setUser(read())]
}

function UserArea() {
    const [user, refresh] = useCurrentUser()
    if (user) {
        return (
            <div className="user">
                <div className="avatar" title={user}>
                    {user[0]}
                </div>
                <div className="username">{user}</div>
                <Button
                    variant="ghost"
                    className="logout"
                    title="Logout"
                    onClick={() => Login.logout(refresh)}
                >
                    <i className="mdi mdi-logout mdi-18px" />
                    <span>Logout</span>
                </Button>
            </div>
        )
    }
    return (
        <div className="user">
            <Button
                variant="primary"
                className="signin"
                onClick={() => {
                    Login.signUp = false
                    Login.openModal()
                }}
            >
                Sign In
            </Button>
        </div>
    )
}

function Nav() {
    return (
        <div className="nav">
            <div className="logo">
                <img src={MMGIS_LOGO_URL} alt="MMGIS logo" />
            </div>
            <div className="links">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                    Documentation
                </a>
                <a href={ABOUT_URL} target="_blank" rel="noreferrer">
                    About
                </a>
                {window.mmgisglobal.AUTH !== 'off' && <UserArea />}
            </div>
        </div>
    )
}

function MissionCard({ missionName, fields, onOpen }) {
    const bannerStyle = useMemo(() => {
        if (fields.imageurl || !fields.color) return undefined
        return {
            backgroundColor: fields.color,
            backgroundImage: gradientFor(fields.color),
        }
    }, [fields.imageurl, fields.color])

    return (
        <div
            className="card"
            data-mission={missionName}
            title={fields.title}
            tabIndex={0}
            role="button"
            onClick={() => onOpen(missionName)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(missionName)
                }
            }}
        >
            <div
                className={'banner' + (bannerStyle ? ' glass' : '')}
                style={bannerStyle}
            >
                {fields.imageurl && (
                    <img src={fields.imageurl} alt={fields.title} />
                )}
            </div>
            <div className="body">
                <div className="titlerow">
                    <h3>{fields.title}</h3>
                    {(fields.dotColor || fields.body) && (
                        <div className="meta">
                            {fields.dotColor && (
                                <span
                                    className="dot"
                                    style={{ '--dot': fields.dotColor }}
                                />
                            )}
                            {fields.body && (
                                <span className="bodyname">
                                    {fields.body}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {fields.subtext && <p>{fields.subtext}</p>}
                {fields.description && (
                    <p className="description">{fields.description}</p>
                )}
            </div>
        </div>
    )
}

function CardGrid({ names, missionsMeta, onOpen }) {
    return (
        <div className="cards">
            {names.map((name) => (
                <MissionCard
                    key={name}
                    missionName={name}
                    fields={getCardFields(name, missionsMeta)}
                    onOpen={onOpen}
                />
            ))}
        </div>
    )
}

function Missions({ missions, missionsMeta, onOpen, hideArchived }) {
    if (hideArchived) {
        missions = missions.filter(
            (m) => !getCardFields(m, missionsMeta).archived
        )
    }
    if (missions.length === 0) {
        return (
            <div id="landingNoMissions">
                {window.mmgisglobal.AUTH === 'local'
                    ? 'You do not have access to any missions. Please contact an administrator.'
                    : 'No missions are available.'}
            </div>
        )
    }
    const hasMeta = missions.some((m) => missionsMeta[m] != null)
    const archived = hasMeta
        ? missions.filter((m) => getCardFields(m, missionsMeta).archived)
        : []
    if (archived.length === 0) {
        return (
            <CardGrid names={missions} missionsMeta={missionsMeta} onOpen={onOpen} />
        )
    }
    const active = missions.filter((m) => !archived.includes(m))
    return (
        <div className="sections">
            {active.length > 0 && (
                <div className="section">
                    <h2>Active Missions</h2>
                    <CardGrid names={active} missionsMeta={missionsMeta} onOpen={onOpen} />
                </div>
            )}
            <div className="section archived">
                <h2>Archived Missions</h2>
                <CardGrid names={archived} missionsMeta={missionsMeta} onOpen={onOpen} />
            </div>
        </div>
    )
}

function Footer() {
    const version = window.mmgisglobal.version
    const clearance = window.mmgisglobal.CLEARANCE_NUMBER
    return (
        <div className="foot">
            <span
                className="version"
                title="Release notes"
                onClick={() => {
                    window.location.href = `https://github.com/NASA-AMMOS/MMGIS/releases/tag/${version}`
                }}
            >
                v{version}
            </span>
            <a
                className="imagecredit"
                target="_blank"
                rel="noreferrer"
                href="https://www.jpl.nasa.gov/"
            >
                NASA/JPL-Caltech
            </a>
            {clearance && clearance !== 'undefined' && (
                <span className="clearance">{clearance}</span>
            )}
        </div>
    )
}

function DevIcons() {
    const goConfigure = () => {
        const base = window.location.href.split('?')[0]
        window.location.href =
            base + (window.mmgisglobal.SERVER === 'node' ? 'configure' : 'config')
    }
    return (
        <>
            <Tooltip content="Configure" placement="top">
                <IconButton id="configIcon" size="lg" onClick={goConfigure}>
                    <i className="mdi mdi-tune mdi-24px" />
                </IconButton>
            </Tooltip>
            <Tooltip content="Documentation" placement="top">
                <IconButton
                    id="docsIcon"
                    size="lg"
                    onClick={() => {
                        window.location.href = DOCS_URL
                    }}
                >
                    <i className="mdi mdi-book-open mdi-24px" />
                </IconButton>
            </Tooltip>
        </>
    )
}

// `onSelectMission(name)` is called after the page has faded out
export default function LandingPage({ missions, missionsMeta, onSelectMission }) {
    const opts = useMemo(getLandingOptions, [])
    const [visible, setVisible] = useState(false)
    const [leaving, setLeaving] = useState(false)

    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(id)
    }, [])

    const open = useCallback(
        (name) => {
            if (leaving) return
            setLeaving(true)
            setTimeout(() => onSelectMission(name), 1000)
        },
        [leaving, onSelectMission]
    )

    const classes = ['landingPage', opts.theme]
    if (opts.backgroundImageUrl) classes.push('hasBackgroundImage')
    if (visible && !leaving) classes.push('visible')

    return (
        <div className={classes.join(' ')}>
            {opts.backgroundImageUrl ? (
                <div
                    className="bgimage"
                    style={{ backgroundImage: `url('${opts.backgroundImageUrl}')` }}
                />
            ) : (
                <div className="topo" />
            )}
            <div className="pg">
                <Nav />
                <div className="main">
                    <h1 className="unselectable">
                        Mapping <span>Better Worlds</span>
                    </h1>
                    <div className="sub">
                        Select a mission to start exploring geospatial data
                    </div>
                    <Missions
                        missions={missions}
                        missionsMeta={missionsMeta}
                        onOpen={open}
                        hideArchived={opts.hideArchived}
                    />
                </div>
                <Footer />
            </div>
            {window.mmgisglobal.NODE_ENV === 'development' && <DevIcons />}
        </div>
    )
}

export function MissionNotFound() {
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(id)
    }, [])
    return (
        <div
            id="notfound"
            className={visible ? 'visible' : ''}
            onClick={() => {
                document.location.href = window.location.href.split('?')[0]
            }}
        >
            <p id="mnfmmgis">{window.mmgisglobal.name || 'MMGIS'}</p>
            <p id="returnmmgis">Click anywhere to return home...</p>
            <div id="nf404">404</div>
        </div>
    )
}
