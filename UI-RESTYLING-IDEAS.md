# MMGIS UI Restyling Ideas

A collection of design concepts and mockups for modernizing the MMGIS user interface. Each approach offers a distinct visual direction while preserving the application's core GIS functionality.

---

## Current UI

The existing MMGIS interface uses **Materialize CSS**, **jQuery UI**, and **React** components. The UI features a dark toolbar sidebar on the left, a full-width map area, and a bottom bar with time controls and coordinates.

### Landing Page
![Landing Page](ui-screenshots/current/01-landing-page.png)

### Main Map View
![Main Map](ui-screenshots/current/02-main-map-view.png)

### Toolbar — Sites
![Sites Tool](ui-screenshots/current/03-toolbar-sites.png)

### Toolbar — Measure
![Measure Tool](ui-screenshots/current/03b-toolbar-measure.png)

### Toolbar — Draw
![Draw Tool](ui-screenshots/current/03c-toolbar-draw.png)

### Toolbar — Isochrone
![Isochrone Tool](ui-screenshots/current/03d-toolbar-isochrone.png)

### Toolbar — Animation
![Animation Tool](ui-screenshots/current/03e-toolbar-animation.png)

### Layers Panel
![Layers Panel](ui-screenshots/current/04-layers-panel.png)

### Bottom Bar & Time Slider
![Bottom Bar](ui-screenshots/current/05-bottom-bar-timeslider.png)

### Login Page
![Login](ui-screenshots/current/09-login-page.png)

### Current UI Observations
- **Color scheme**: Dark charcoal/gray backgrounds (`#1a1a1a`–`#2a2a2a`), cyan/teal accents
- **Typography**: Default system fonts, Materialize CSS type scale
- **Layout**: Fixed sidebar (left), docked tool panels, bottom status bar
- **Controls**: Materialize checkboxes, standard HTML inputs, jQuery UI sliders
- **Borders**: Sharp corners, 1px solid borders, minimal shadows
- **Icons**: Material Design Icons (MDI) via icon fonts

---

## Mockup 1: Dark Mode Modernization

![Dark Mode Mockup](ui-screenshots/mockups/01-dark-mode.png)

### Design Philosophy
Retains the existing dark aesthetic but elevates it with **deeper navy tones**, **softer accent colors**, and **modern polish**. This is the lowest-friction approach — it feels like a natural evolution rather than a redesign.

### Key Visual Changes
- **Backgrounds**: Shift from flat charcoal (`#2a2a2a`) to rich navy gradients (`#1a1a2e` → `#16213e`)
- **Accent color**: Replace bright cyan with softer teal/cyan (`#00d2d3`)
- **Corners**: Round all panels and controls (`border-radius: 8–10px`)
- **Typography**: Switch to Inter or Roboto for a cleaner, more modern feel
- **Toggle switches**: Replace Materialize checkboxes with pill-style toggles
- **Sidebar**: Icon-only rail with active state indicator (left border glow)
- **Bottom bar**: Gradient background with glowing time slider thumb

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/css/mmgis.css` | Base background colors, font-family, global border-radius |
| `src/css/mmgisUI.css` | Sidebar styling, tool panel backgrounds, toggle switches |
| `src/css/tools.css` | Tool panel headers, section dividers, layer item styling |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | Bottom bar gradient, coordinate display, time slider |

### Specific CSS Changes
```css
/* Global background shift */
body, #viewer { background: #0f0f1a; }

/* Sidebar modernization */
#toolBar { background: linear-gradient(180deg, #1a1a2e, #16213e); border-right: 1px solid rgba(0,210,211,0.1); }
#toolBar .tool { border-radius: 10px; transition: all 0.2s; }
#toolBar .tool.active { background: rgba(0,210,211,0.15); box-shadow: inset 3px 0 0 #00d2d3; }

/* Layer toggles → pill switches */
.layer-toggle input[type="checkbox"] { appearance: none; width: 32px; height: 18px; border-radius: 9px; background: #2d2d4a; }
.layer-toggle input[type="checkbox"]:checked { background: rgba(0,210,211,0.3); }

/* Typography */
* { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
```

---

## Mockup 2: Light / Clean Minimal Theme

![Light Minimal Mockup](ui-screenshots/mockups/02-light-minimal.png)

### Design Philosophy
A **complete tonal inversion** inspired by **Material Design 3** and **Apple Human Interface Guidelines**. Clean whites, generous whitespace, and subtle shadows replace the current dark chrome. Ideal for daytime use, presentations, and users who prefer light interfaces.

### Key Visual Changes
- **Backgrounds**: White (`#ffffff`) panels, light gray (`#f5f5f7`) map surround
- **Shadows**: Replace hard borders with soft `box-shadow` (e.g., `0 1px 3px rgba(0,0,0,0.06)`)
- **Accent color**: System blue (`#007aff`) for primary actions, green (`#34c759`) for active toggles
- **Spacing**: Increase padding throughout (16→20px panel padding, 8→10px item spacing)
- **Search**: Prominent search bar in top navigation
- **Section headers**: Uppercase, letter-spaced category labels
- **Toggles**: iOS-style green switches

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/css/mmgis.css` | Invert all background/foreground colors, add box-shadows |
| `src/css/mmgisUI.css` | White sidebar, light borders, blue active states |
| `src/css/tools.css` | White tool panels, increased padding, iOS-style toggles |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | White bottom bar, blue time slider |
| All tool CSS files in `src/essence/Tools/` | Light theme overrides for each tool |

### Specific CSS Changes
```css
/* Light theme base */
body, #viewer { background: #f5f5f7; color: #1d1d1f; }

/* White panels with shadows */
#toolBar, .toolPanel { background: #ffffff; border: none; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

/* Blue active states */
.tool.active { background: #007aff; color: #ffffff; box-shadow: 0 2px 8px rgba(0,122,255,0.3); }

/* iOS-style toggles */
.toggle-switch:checked { background: #34c759; }

/* Increased whitespace */
.layerItem { padding: 8px 20px; }
.sectionHeader { text-transform: uppercase; letter-spacing: 0.8px; font-size: 12px; color: #86868b; }
```

---

## Mockup 3: Redesigned Sidebar / Tool Panel

![Redesigned Sidebar Mockup](ui-screenshots/mockups/03-redesigned-sidebar.png)

### Design Philosophy
Focuses on the **sidebar and tool panel architecture** rather than overall theming. Introduces a **floating, detached panel** with **glassmorphism** (frosted glass effect), **collapsible accordion sections**, per-layer **opacity sliders**, and **color-coded layer indicators**. The panel floats over the map rather than being docked to the edge.

### Key Visual Changes
- **Floating panel**: Detached from sidebar with `border-radius: 16px`, not edge-to-edge
- **Glassmorphism**: `backdrop-filter: blur(24px) saturate(180%)` with semi-transparent background
- **Window controls**: macOS-style minimize/maximize/close dots (yellow/green/red)
- **Accordion sections**: Click-to-expand groups with smooth transitions
- **Layer color dots**: Small colored circles indicating layer symbology
- **Inline opacity**: Each layer shows a mini opacity bar and percentage
- **Collapsed sidebar preview**: Right-side compact tool dock with icon + label

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/css/mmgisUI.css` | Floating panel positioning, glassmorphism backdrop, border-radius |
| `src/css/tools.css` | Accordion animation, color dots, opacity slider inline |
| `src/essence/Tools/Layers_/Layers_.css` | Layer item layout with color dot + opacity bar |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | Panel detachment from edge, floating container |

### Specific CSS Changes
```css
/* Floating glassmorphism panel */
.toolPanel {
  position: absolute; left: 60px; top: 56px; bottom: 52px;
  width: 310px; border-radius: 16px;
  background: rgba(22,27,34,0.75);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* Accordion sections */
.layerGroup { border-bottom: 1px solid rgba(255,255,255,0.04); }
.layerGroup-header { cursor: pointer; transition: background 0.15s; }
.layerGroup-header:hover { background: rgba(255,255,255,0.02); }

/* Inline opacity */
.layer-opacity { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.opacity-bar { width: 40px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; }
```

---

## Mockup 4: Modernized Top Navigation Bar

![Modernized Navigation Mockup](ui-screenshots/mockups/04-modernized-navigation.png)

### Design Philosophy
Adds a **feature-rich top navigation** that provides context, search, and quick actions — elements missing from the current UI. Includes **breadcrumb navigation**, a **command palette search** (Cmd+K), **notification bell**, **mission selector dropdown**, **user avatar with role**, and a **secondary tab bar** for view switching (Map/Globe/Data/Timeline).

### Key Visual Changes
- **Two-tier navigation**: Primary nav (56px) + secondary tab bar (40px)
- **Breadcrumb**: `/ Missions / Reference Mission` path display
- **Search bar**: 320px wide with keyboard shortcut hint (`⌘K`)
- **Mission selector**: Dropdown button showing current mission name
- **User area**: Avatar circle + username + role label
- **Tab bar**: Map | Globe | Data | Timeline | Compare tabs
- **View toggle**: 2D / 3D / Split view selector
- **Status bar**: Connection dot, coordinate display, layer/tool counts

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/css/mmgis.css` | Add secondary navbar, adjust main content top offset |
| `src/css/mmgisUI.css` | Top bar restructuring, breadcrumb, search bar, tabs |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | Status bar redesign with connection indicator |

### Specific CSS Changes
```css
/* Two-tier navigation */
.navbar-primary { height: 56px; background: #252a3a; display: flex; align-items: center; }
.navbar-secondary { height: 40px; background: #1e2233; display: flex; align-items: center; }

/* Breadcrumb */
.breadcrumb { display: flex; gap: 6px; font-size: 12px; color: #8892b0; }
.breadcrumb .current { color: #e0e0e0; font-weight: 500; }

/* Command palette search */
.search-bar { width: 320px; border-radius: 8px; background: rgba(255,255,255,0.05); }
.search-bar:focus { border-color: rgba(108,158,255,0.4); }

/* Tab bar */
.tab.active { color: #6c9eff; border-bottom: 2px solid #6c9eff; }

/* Mission selector */
.mission-selector { background: rgba(108,158,255,0.08); border: 1px solid rgba(108,158,255,0.15); border-radius: 8px; }
```

---

## Mockup 5: Card-Based Layer Management

![Card-Based Layers Mockup](ui-screenshots/mockups/05-card-based-layers.png)

### Design Philosophy
Reimagines layer management as a **card-based interface** inspired by modern project management tools (Notion, Linear). Each layer becomes a visual card with **thumbnail preview**, **type badge**, **feature count**, **inline opacity slider**, **toggle switch**, and **drag handle**. Layers are more scannable and information-dense while remaining clean.

### Key Visual Changes
- **Layer cards**: Each layer is a rounded card (`border-radius: 10px`) with hover highlight
- **Thumbnails**: 48×48 color-coded icons by layer type (vector=indigo, tile=green, raster=orange, model=purple)
- **Type badges**: Small colored pills (`VECTOR`, `TILE`, `MODEL`) below the layer name
- **Toggle switches**: Right-aligned pill toggles (not checkboxes)
- **Drag handles**: `::` grip indicators for drag-and-drop reordering
- **Opacity sliders**: Inline track + fill + percentage per card
- **Section dividers**: Uppercase labels with horizontal rule
- **Panel header actions**: `+ Add` and `⇵ Sort` buttons

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/essence/Tools/Layers_/Layers_.css` | Complete layer list redesign → card grid |
| `src/css/tools.css` | Card container styling, section dividers |
| `src/css/mmgisUI.css` | Panel header with action buttons |

### Specific CSS Changes
```css
/* Layer card */
.layer-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 10px 12px; display: flex; gap: 10px;
  transition: border-color 0.15s, background 0.15s;
}
.layer-card:hover { background: rgba(129,140,248,0.05); border-color: rgba(129,140,248,0.15); }

/* Type badges */
.card-type { font-size: 9px; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; font-weight: 600; }
.card-type.vector { background: rgba(99,102,241,0.15); color: #818cf8; }
.card-type.tile { background: rgba(16,185,129,0.15); color: #34d399; }

/* Drag handle */
.drag-handle { cursor: grab; color: #374151; letter-spacing: 2px; }
.drag-handle:active { cursor: grabbing; }
```

---

## Mockup 6: Floating Widgets / Detached Panels

![Floating Widgets Mockup](ui-screenshots/mockups/06-floating-widgets.png)

### Design Philosophy
Breaks tools out of the docked sidebar into **independently floating, draggable widget panels**. Each tool becomes a standalone window with **minimize/maximize/close controls**, **semi-transparent backgrounds**, and **rounded corners**. Users can freely arrange their workspace. A compact **dock** replaces the full sidebar.

### Key Visual Changes
- **Widget panels**: Each tool floats independently over the map
- **Window chrome**: macOS-style yellow/green/red control dots
- **Semi-transparent**: `background: rgba(15,23,42,0.82)` with `backdrop-filter: blur(20px)`
- **Draggable**: `cursor: move` header for repositioning
- **Minimizable**: Info widget shown in minimized (title-bar only) state
- **Compact dock**: Vertical icon strip replaces full sidebar
- **Coordinate bar**: Floating bottom-left compact widget
- **Time slider bar**: Floating bottom-center widget

### CSS Files to Modify
| File | Changes |
|------|---------|
| `src/css/mmgisUI.css` | Replace docked sidebar with floating dock, widget container system |
| `src/css/tools.css` | Widget panel base class, window chrome, drag behavior |
| `src/essence/Tools/Draw_/Draw_.css` | Grid-based draw tool selector within widget |
| `src/essence/Tools/Measure_/Measure_.css` | Large measurement display within widget |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | Floating coordinate and time widgets |

### Specific CSS Changes
```css
/* Widget base */
.widget {
  position: absolute; border-radius: 14px;
  background: rgba(15,23,42,0.82);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

/* Window controls */
.widget-header { cursor: move; display: flex; align-items: center; }
.ctrl-btn { width: 12px; height: 12px; border-radius: 50%; }
.ctrl-btn.minimize { background: #fbbf24; }
.ctrl-btn.maximize { background: #34d399; }
.ctrl-btn.close { background: #f87171; }

/* Compact dock */
.dock {
  position: absolute; left: 12px; top: 56px; width: 44px;
  border-radius: 12px;
  background: rgba(15,23,42,0.8); backdrop-filter: blur(16px);
}
```

---

## Mockup 7: Component Library / Design System Preview

![Component Library Mockup](ui-screenshots/mockups/07-component-library.png)

### Design Philosophy
Not a UI layout mockup — this is a **design system reference sheet** showing the building blocks needed to implement any of the above approaches. Defines a **color palette**, **typography scale**, **button variants**, **form elements**, **toggle switches**, **sliders**, **badges**, **tooltips**, and an **icon set**. This would serve as the foundation for a consistent, maintainable UI overhaul.

### Components Defined

#### Color Palette
| Role | Color | Hex |
|------|-------|-----|
| Primary | Sky Blue | `#38bdf8` |
| Secondary | Indigo | `#818cf8` |
| Success | Emerald | `#34d399` |
| Warning | Amber | `#fbbf24` |
| Danger | Red | `#f87171` |
| Info | Cyan | `#22d3ee` |
| Base BG | Darkest | `#0f172a` |
| Surface | Card BG | `#1e293b` |
| Elevated | Hover | `#334155` |
| Border | Subtle | `#475569` |
| Muted Text | Secondary | `#64748b` |
| Primary Text | Light | `#94a3b8` |

#### Typography Scale
| Level | Size | Weight | Use Case |
|-------|------|--------|----------|
| H1 | 32px | 700 | Page titles |
| H2 | 24px | 700 | Panel headers |
| H3 | 18px | 600 | Section headers |
| H4 | 14px | 600 | Layer names |
| Body | 14px | 400 | Descriptions |
| Small | 12px | 400 | Metadata |
| Caption | 10px | 600 | Category labels |
| Mono | 13px | 400 | Coordinates |

#### Button Variants
- **Primary**: Solid fill (`#38bdf8`), dark text
- **Secondary**: Transparent with border, colored text
- **Ghost**: Transparent with subtle border, muted text
- **Danger**: Red fill (`#f87171`), white text
- **Success**: Green fill (`#34d399`), dark text
- **Sizes**: Small (5px 12px), Default (8px 18px), Large (12px 24px)
- **Icon buttons**: Square, icon-only for toolbar actions

#### Form Elements
- Text inputs with focus ring (`border-color: rgba(56,189,248,0.4)`)
- Select dropdowns with custom chevron
- Toggle switches (40×22px pill style)
- Checkboxes (18×18px rounded square)
- Radio buttons (18×18px circle)
- Range sliders with gradient fill

### Recommended Icon Libraries
Replace current MDI icon font with one of:
- **[Lucide](https://lucide.dev/)** — Clean, consistent, tree-shakeable SVGs
- **[Phosphor](https://phosphoricons.com/)** — Flexible weights, extensive set
- **[Heroicons](https://heroicons.com/)** — Tailwind-aligned, minimal

---

## Implementation Recommendations

### Priority Order
1. **Mockup 1 (Dark Mode Modernization)** — Lowest risk, highest impact. Mostly CSS changes.
2. **Mockup 7 (Component Library)** — Establish design tokens before any visual work.
3. **Mockup 5 (Card-Based Layers)** — Significant UX improvement for the most-used panel.
4. **Mockup 3 (Redesigned Sidebar)** — Glassmorphism + floating panel is a modern upgrade.
5. **Mockup 4 (Modernized Navigation)** — Adds missing navigation features.
6. **Mockup 6 (Floating Widgets)** — Most complex, requires drag/drop JS infrastructure.
7. **Mockup 2 (Light Theme)** — Should be implemented as a theme toggle alongside dark.

### Key CSS Files Reference
| File | Purpose |
|------|---------|
| `src/css/mmgis.css` | Global styles, base layout, colors |
| `src/css/mmgisUI.css` | Sidebar, toolbar, panel positioning |
| `src/css/tools.css` | Tool panel shared styles |
| `src/essence/Basics/UserInterface_/UserInterfaceDefault_.css` | Bottom bar, coordinates, time controls |
| `src/essence/Tools/Layers_/Layers_.css` | Layer list styling |
| `src/essence/Tools/Draw_/Draw_.css` | Draw tool interface |
| `src/essence/Tools/Measure_/Measure_.css` | Measure tool interface |
| `src/essence/Tools/Info_/Info_.css` | Info/feature panel |
| `src/essence/Tools/Legend_/Legend_.css` | Legend panel |
| `src/essence/Tools/Chemistry_/Chemistry_.css` | Chemistry tool |
| `src/essence/Tools/Isochrone_/Isochrone_.css` | Isochrone tool |

### Technical Approach
1. **CSS Custom Properties**: Define all colors, radii, shadows as `--mmgis-*` variables for easy theming
2. **Replace Materialize CSS**: Gradually replace Materialize components with custom CSS or a lighter framework
3. **Font loading**: Add Inter via `@font-face` or Google Fonts CDN
4. **Glassmorphism support**: Add `backdrop-filter` with fallbacks for unsupported browsers
5. **Dark/Light toggle**: Use `data-theme` attribute on `<body>` to switch between themes
6. **Component extraction**: Extract repeated patterns (toggles, badges, cards) into reusable CSS classes

---

## Mockup Source Files

The HTML/CSS source files for each mockup are located at:
- `ui-screenshots/mockups/01-dark-mode.html`
- `ui-screenshots/mockups/02-light-minimal.html`
- `ui-screenshots/mockups/03-redesigned-sidebar.html`
- `ui-screenshots/mockups/04-modernized-navigation.html`
- `ui-screenshots/mockups/05-card-based-layers.html`
- `ui-screenshots/mockups/06-floating-widgets.html`
- `ui-screenshots/mockups/07-component-library.html`

Open any of these in a browser to see the full interactive mockup.
