import s from '../essence'
import $ from 'jquery'
import QueryURL from '../services/QueryURL'
import calls from '../../pre/calls'
import { mmgisAPI_ } from '../mmgisAPI/mmgisAPI'
import Login from '../Basics/UserInterface_/components/Login/Login'

import './LandingPage.css'

const mmgisLogoURL = 'public/images/logos/mmgis.png'
const DOCS_URL = 'https://nasa-ammos.github.io/MMGIS/'
const ABOUT_URL = 'https://github.com/NASA-AMMOS/MMGIS'

export default {
    init: function (missions, forceError, forceConfig, missionsMeta) {
        if (forceError) {
            makeMissionNotFoundDiv()
            return
        }

        // Skip loading the landing page if the preview mode is controlling the config
        if (QueryURL.getSingleQueryVariable('_preview')) {
            if (typeof mmgisAPI_.onLoadCallback === 'function') {
                mmgisAPI_.onLoadCallback()
                mmgisAPI_.onLoadCallback = null
            }
            return
        }

        missions = missions || []
        missionsMeta = missionsMeta || {}

        var missionUrl
        var forceLanding =
            QueryURL.getSingleQueryVariable('forcelanding') || false

        if (!forceConfig) {
            missionUrl = QueryURL.checkIfMission()

            //If there's only one mission, go straight to it
            if (missions.length == 1 && !forceLanding) missionUrl = missions[0]
        }

        if (
            missionUrl == false &&
            !forceLanding &&
            mmgisglobal.MAIN_MISSION != null &&
            mmgisglobal.MAIN_MISSION != '' &&
            mmgisglobal.MAIN_MISSION != 'undefined' &&
            typeof mmgisglobal.MAIN_MISSION === 'string' &&
            mmgisglobal.MAIN_MISSION.length > 0 &&
            (mmgisglobal.AUTH !== 'local' ||
                missions.includes(mmgisglobal.MAIN_MISSION))
        ) {
            missionUrl = mmgisglobal.MAIN_MISSION
        }

        if (missionUrl == false && !forceConfig) {
            makeLandingPage(missions, missionsMeta)
        } else {
            //Load the config file and initialize
            var jsonUrl = 'Missions/' + missionUrl + '/' + 'config.json'
            if (forceConfig) {
                jsonUrl = forceConfig
                $.getJSON(
                    jsonUrl + '?nocache=' + new Date().getTime(),
                    function (data) {
                        //Initialize
                        s.init(data, missions)
                    }
                ).fail(function () {
                    console.error(
                        "Error: Couldn't load: " + jsonUrl + ' configuration.'
                    )
                    makeMissionNotFoundDiv()
                })
            } else {
                if (window.mmgisglobal.SERVER == 'node') {
                    calls.api(
                        'get',
                        {
                            mission: missionUrl,
                            full: true,
                        },
                        function (response) {
                            // Extract DB mission name and attach to config
                            const config = response.config || response
                            if (response.mission) {
                                config._dbMissionName = response.mission
                            }
                            s.init(config, missions)
                        },
                        function (e) {
                            console.error(
                                "Error: Couldn't load: " +
                                    missionUrl +
                                    ' configuration.'
                            )
                            makeMissionNotFoundDiv()
                        }
                    )
                } else {
                    $.getJSON(
                        jsonUrl + '?nocache=' + new Date().getTime(),
                        function (data) {
                            //Initialize
                            s.init(data, missions)
                        }
                    ).fail(function () {
                        console.warn("Warning: Couldn't load: " + jsonUrl)
                        makeMissionNotFoundDiv()
                    })
                }
            }
        }
    },
}

function getCardFields(missionName, missionsMeta) {
    const meta = missionsMeta[missionName]
    const look = (meta && meta.config && meta.config.look) || {}
    const card = look.card || {}
    return {
        title:
            typeof look.missionname === 'string' && look.missionname.trim()
                ? look.missionname
                : missionName,
        color:
            typeof card.color === 'string' && card.color.trim()
                ? card.color
                : null,
        imageurl:
            typeof card.imageurl === 'string' && card.imageurl.trim()
                ? resolveImageUrl(card.imageurl, missionName)
                : null,
        subtext:
            typeof card.subtext === 'string' && card.subtext.trim()
                ? card.subtext
                : null,
        archived: card.archived === true,
    }
}

function resolveImageUrl(url, missionName) {
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    if (url.startsWith('public/') || url.startsWith('/')) return url
    return 'Missions/' + missionName + '/' + url
}

function loadMission(missionName, missions) {
    $('.landingPage').animate({ opacity: 0 }, 1000, function () {
        $(this).remove()
        //Load the config file and initialize
        if (window.mmgisglobal.SERVER == 'node') {
            calls.api(
                'get',
                {
                    mission: missionName,
                    full: true,
                },
                function (response) {
                    // Extract DB mission name and attach to config
                    const config = response.config || response
                    if (response.mission) {
                        config._dbMissionName = response.mission
                    }
                    s.init(config, missions)
                },
                function (e) {
                    console.log(
                        "Warning: Couldn't load: " +
                            missionName +
                            ' configuration.'
                    )
                    makeMissionNotFoundDiv()
                }
            )
        } else {
            $.getJSON(
                'Missions/' +
                    missionName +
                    '/' +
                    'config.json' +
                    '?nocache=' +
                    new Date().getTime(),
                function (data) {
                    //Initialize
                    s.init(data, missions)
                }
            ).fail(function () {
                console.log(
                    "Warning: Couldn't load: " +
                        'Missions/' +
                        missionName +
                        '/' +
                        'config.json'
                )
                makeMissionNotFoundDiv()
            })
        }
    })
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

function makeCard(missionName, fields, missions) {
    const card = $('<div>')
        .attr('class', 'card')
        .attr('data-mission', missionName)
        .attr('title', fields.title)
        .attr('tabindex', 0)
        .attr('role', 'button')

    const banner = $('<div>').attr('class', 'banner')
    if (fields.imageurl) {
        banner.append(
            $('<img>').attr('src', fields.imageurl).attr('alt', fields.title)
        )
    } else if (fields.color) {
        banner
            .addClass('glass')
            .css('background-color', fields.color)
            .css('background-image', gradientFor(fields.color))
    }
    card.append(banner)

    const body = $('<div>').attr('class', 'body')
    body.append($('<h3>').text(fields.title))
    if (fields.subtext) body.append($('<p>').text(fields.subtext))
    card.append(body)

    const open = function () {
        loadMission($(this).attr('data-mission'), missions)
    }
    card.on('click', open).on('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open.call(this)
        }
    })
    return card
}

function makeCardGrid(names, missions, missionsMeta) {
    const grid = $('<div>').attr('class', 'cards')
    names.forEach((name) => {
        grid.append(makeCard(name, getCardFields(name, missionsMeta), missions))
    })
    return grid
}

function makeContours() {
    return $('<div>').attr('class', 'topo')
}

function makeUserArea() {
    const userArea = $('<div>').attr('class', 'user')
    const renderState = function () {
        userArea.empty()
        const user = window.mmgisglobal.user
        const loggedIn = user != null && user !== 'guest' && user !== ''
        if (loggedIn) {
            userArea.append(
                $('<div>')
                    .attr('class', 'avatar')
                    .attr('title', user)
                    .text(String(user)[0])
            )
            userArea.append($('<div>').attr('class', 'username').text(user))
            userArea.append(
                $('<button>')
                    .attr('class', 'logout')
                    .attr('title', 'Logout')
                    .attr('type', 'button')
                    .append($('<i>').attr('class', 'mdi mdi-logout mdi-18px'))
                    .append($('<span>').text('Logout'))
                    .on('click', function () {
                        Login.logout(renderState)
                    })
            )
        } else {
            userArea.append(
                $('<button>')
                    .attr('class', 'signin')
                    .attr('type', 'button')
                    .text('Sign In')
                    .on('click', function () {
                        Login.signUp = false
                        Login.openModal()
                    })
            )
        }
    }
    renderState()
    document.addEventListener('mmgis:loginchange', renderState)
    return userArea
}

function getLandingOptions() {
    const o =
        (window.mmgisglobal.options &&
            window.mmgisglobal.options.landingPage) ||
        {}
    return {
        theme: o.theme === 'dark' ? 'dark' : 'light',
        backgroundImageUrl:
            typeof o.backgroundImageUrl === 'string' &&
            o.backgroundImageUrl.trim()
                ? o.backgroundImageUrl.trim()
                : null,
    }
}

function makeLandingPage(missions, missionsMeta) {
    const opts = getLandingOptions()
    const background = $('<div>')
        .attr('class', 'landingPage')
        .addClass(opts.theme)
    $('body').append(background)

    if (opts.backgroundImageUrl) {
        background.addClass('hasBackgroundImage')
        background.append(
            $('<div>')
                .attr('class', 'bgimage')
                .css('background-image', "url('" + opts.backgroundImageUrl + "')")
        )
    } else {
        background.append(makeContours())
    }

    const pg = $('<div>').attr('class', 'pg')
    background.append(pg)

    // Nav
    const nav = $('<div>').attr('class', 'nav')
    pg.append(nav)
    nav.append(
        $('<div>')
            .attr('class', 'logo')
            .append(
                $('<img>')
                    .attr('src', mmgisLogoURL)
                    .attr('alt', 'MMGIS logo')
            )
    )
    const links = $('<div>').attr('class', 'links')
    nav.append(links)
    links.append(
        $('<a>')
            .attr('href', DOCS_URL)
            .attr('target', '_blank')
            .attr('rel', 'noreferrer')
            .text('Documentation')
    )
    links.append(
        $('<a>')
            .attr('href', ABOUT_URL)
            .attr('target', '_blank')
            .attr('rel', 'noreferrer')
            .text('About')
    )
    if (window.mmgisglobal.AUTH !== 'off') links.append(makeUserArea())

    // Main
    const main = $('<div>').attr('class', 'main')
    pg.append(main)
    main.append(
        $('<h1>')
            .attr('class', 'unselectable')
            .append(document.createTextNode('Mapping '))
            .append($('<span>').text('Better Worlds'))
    )
    main.append(
        $('<div>')
            .attr('class', 'sub')
            .text('Select a mission to start exploring geospatial data')
    )

    if (missions.length === 0) {
        main.append(
            $('<div>')
                .attr('id', 'landingNoMissions')
                .text(
                    window.mmgisglobal.AUTH === 'local'
                        ? 'You do not have access to any missions. Please contact an administrator.'
                        : 'No missions are available.'
                )
        )
    } else {
        const hasMeta = missions.some((m) => missionsMeta[m] != null)
        const archived = hasMeta
            ? missions.filter(
                  (m) => getCardFields(m, missionsMeta).archived === true
              )
            : []
        if (archived.length > 0) {
            const active = missions.filter((m) => !archived.includes(m))
            const sections = $('<div>').attr('class', 'sections')
            main.append(sections)
            if (active.length > 0) {
                sections.append(
                    $('<div>')
                        .attr('class', 'section')
                        .append($('<h2>').text('Active Missions'))
                        .append(makeCardGrid(active, missions, missionsMeta))
                )
            }
            sections.append(
                $('<div>')
                    .attr('class', 'section archived')
                    .append($('<h2>').text('Archived Missions'))
                    .append(makeCardGrid(archived, missions, missionsMeta))
            )
        } else {
            main.append(makeCardGrid(missions, missions, missionsMeta))
        }
    }

    // Footer
    const foot = $('<div>').attr('class', 'foot')
    pg.append(foot)
    foot.append(
        $('<span>')
            .attr('class', 'version')
            .attr('title', 'Release notes')
            .text(`v${window.mmgisglobal.version}`)
            .on('click', function () {
                window.location.href = `https://github.com/NASA-AMMOS/MMGIS/releases/tag/${window.mmgisglobal.version}`
            })
    )
    foot.append(
        $('<a>')
            .attr('class', 'imagecredit')
            .attr('target', '_blank')
            .attr('rel', 'noreferrer')
            .attr('href', 'https://www.jpl.nasa.gov/')
            .text('NASA/JPL-Caltech')
    )
    if (
        window.mmgisglobal.CLEARANCE_NUMBER &&
        window.mmgisglobal.CLEARANCE_NUMBER != 'undefined'
    ) {
        foot.append(
            $('<span>')
                .attr('class', 'clearance')
                .text(window.mmgisglobal.CLEARANCE_NUMBER)
        )
    }

    if (window.mmgisglobal.NODE_ENV == 'development') {
        const configIcon = $('<div>')
            .attr('id', 'configIcon')
            .attr('class', 'mdi mdi-tune mdi-24px')
            .attr('title', 'Configure')
            .on('click', function () {
                if (window.mmgisglobal.SERVER === 'node')
                    window.location.href =
                        window.location.href.split('?')[0] + 'configure'
                else
                    window.location.href =
                        window.location.href.split('?')[0] + 'config'
            })
        background.append(configIcon)

        const docsIcon = $('<div>')
            .attr('id', 'docsIcon')
            .attr('class', 'mdi mdi-book-open mdi-24px')
            .attr('title', 'Documentation')
            .on('click', function () {
                window.location.href = DOCS_URL
            })
        background.append(docsIcon)
    }

    $('.landingPage').animate({ opacity: 1 }, 1000)
}

export const makeMissionNotFoundDiv = () => {
    var notfounddiv = $('<div>')
        .attr('id', 'notfound')
        .css({
            'position': 'absolute',
            'top': '0',
            'left': '0',
            'width': '100%',
            'height': '100%',
            'background': '#efefef',
            'color': '#757575',
            'opacity': 0,
            'cursor': 'pointer',
            'z-index': 1000
        })
        .on('click', function () {
            document.location.href = window.location.href.split('?')[0]
        })
    $('body').append(notfounddiv)

    notfounddiv
        .append($('<p>')
        .attr('id', 'mnfmmgis')
        .css({
            'font-family': 'lato',
            'font-size': '20px',
            'margin': '90px 0',
            'text-align': 'center',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%)'
        })
        .text(window.mmgisglobal.name || 'MMGIS'))

    notfounddiv
        .append($('<p>')
        .attr('id', 'returnmmgis')
        .css({
            'font-family': 'lato',
            'font-size': '14px',
            'margin': '125px 0 90px 0',
            'text-align': 'center',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%)'
        })
        .text('Click anywhere to return home...'))

    notfounddiv
        .append($('<div>')
        .attr('id', 'nf404')
        .css({
            'font-family': 'monospace',
            'font-size': '200px',
            'margin-top': '5px',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%) translateY(-50%)',
            'color': 'var(--color-b)'
        })
        .html('404'))

    $('#notfound').animate(
        {
            opacity: 1,
        },
        1500
    )
}
