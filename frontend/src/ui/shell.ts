/** Static application markup only. User-provided content is always assigned as text. */
export const shell = `
  <header class="app-header">
    <a href="./" class="brand"><span class="brand-mark" aria-hidden="true">◇</span><span id="brand-name">Dimentionalizer</span><span class="version">v1.0</span></a>
    <span class="header-caption">STRUCTURE, IN PERSPECTIVE</span>
    <div class="header-actions"><button id="spaces-button">Spaces <span>▱</span></button><button id="presets-button">Presets <span>▦</span></button><button id="catalog-button">Object catalog <span>↗</span></button><button id="config-button" class="primary">Configure <span>⌘</span></button></div>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="Structure directory">
      <section class="intro"><div id="eyebrow" class="eyebrow"></div><h1 id="headline"></h1><p id="description"></p></section>
      <div class="stats"><div><strong id="group-count">0</strong><span>GROUPS</span></div><div><strong id="object-count">0</strong><span>OBJECTS</span></div><div><strong id="connection-count">0</strong><span>LINKS</span></div></div>
      <div class="space-navigation"><label class="type-filter">Space<select id="space-focus" aria-label="Current space"></select></label><button id="space-back" disabled>← Back to outer view</button><p id="space-context" class="muted"></p></div>
      <div class="section-heading">NETWORK DIRECTORY <span id="visible-count"></span></div>
      <label class="type-filter">Plane<select id="plane-filter" aria-label="Plane filter"></select></label>
      <button id="inspect-plane" class="scope-button" disabled>Inspect plane & connections ↗</button>
      <p id="model-notice" class="layout-notice" role="status" hidden></p>
      <p id="layout-notice" class="layout-notice" role="status" hidden></p>
      <label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="Search objects" placeholder="Find an object…" /></label>
      <label class="type-filter">Object type<select id="type-filter"><option value="all">All types</option></select></label>
      <nav id="groups" class="groups" aria-label="Groups"></nav>
      <div id="group-elevation-controls" hidden></div>
      <div class="section-heading object-heading">OBJECTS <span>SELECT TO INSPECT</span></div>
      <div id="object-list" class="object-list"></div>
      <p class="sidebar-foot">A map of your structure.<br>Not live telemetry.</p>
    </aside>
    <section class="stage" aria-label="Structure visualization">
      <div class="stage-heading"><span><i class="status-dot"></i> <span id="scene-status">SPATIAL VIEW</span></span><span id="scene-context">ENTIRE NETWORK</span></div>
      <div id="scene-host"></div>
      <div id="fallback" class="fallback" hidden><span class="fallback-symbol">◇</span><h2>Your world, connected.</h2><p>3D is unavailable in this browser. Explore every object and its connections in the directory.</p><p class="muted">Enable WebGL / hardware acceleration to use the spatial view.</p><div id="fallback-summary"></div></div>
      <div id="empty-state" class="empty-state" hidden><h2>A new space to build.</h2><p>Open Configure to add groups and objects.</p></div>
      <div class="viewbar" aria-label="View controls"><button id="names" aria-pressed="true">◉ <span>Names</span></button><button id="orbit" aria-pressed="false">◌ <span>Auto orbit</span></button><button id="effects" aria-pressed="true">✧ <span>Effects</span></button><button id="grid" aria-pressed="true" aria-label="World grid visibility">▦ <span>Grid</span></button><button id="plane-frames" aria-pressed="true" title="Show or hide all plane frames; keep contents visible">▱ <span>Plane frames</span></button><button id="group-frames" aria-pressed="true" title="Show or hide all group frames; keep contents visible">▢ <span>Group frames</span></button><span class="control-divider"></span><button id="reset-view">⌖ <span>Reset view</span></button></div>
      <div class="stage-footer"><span>DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM <b>·</b> CLICK TO INSPECT</span><span>DIMENSION / 01</span></div>
    </section>
    <aside id="inspector" class="inspector" aria-label="Architecture inspector" hidden>
      <div class="section-heading"><span id="inspector-label">OBJECT INSPECTOR</span> <button id="close-inspector" aria-label="Close inspector">×</button></div>
      <div id="inspector-content"></div>
      <div id="inspector-nav" class="inspector-nav"><button id="previous-object">← Previous</button><span id="object-position"></span><button id="next-object">Next →</button></div>
    </aside>
  </main>
  <div id="notice" class="notice" role="status" hidden></div>
  <dialog id="configuration" aria-labelledby="config-title">
    <div class="dialog-heading"><span class="eyebrow">STRUCTURE DOCUMENT</span><button data-close="configuration" aria-label="Close configuration">×</button></div>
    <h2 id="config-title">Your structure. Your story.</h2><p>Edit your title, appearance, planes, groups, objects, and connections. Changes stay in this browser; export JSON to share or save them in your repository.</p>
    <p id="draft-notice" class="draft-notice" role="status" hidden></p>
    <div class="editor-toolbar"><label for="json-editor">CONFIGURATION.JSON</label><div><button id="import-button">Import JSON</button><button id="export-button">Export draft</button><button id="restore-button">Load default</button></div></div>
    <input id="import-file" type="file" accept=".json,application/json" hidden />
    <textarea id="json-editor" spellcheck="false" aria-describedby="config-error"></textarea>
    <div id="config-error" class="error" role="alert"></div>
    <div class="dialog-bottom"><span>Version 1 · Up to 500 objects</span><button id="apply-button" class="primary">Apply configuration ↗</button></div>
  </dialog>
  <dialog id="catalog" aria-labelledby="catalog-title">
    <div class="dialog-heading"><span class="eyebrow">THE BUILDING BLOCKS</span><button data-close="catalog" aria-label="Close catalog">×</button></div>
    <h2 id="catalog-title">Objects for any world.</h2><p>People, products, places, systems, and processes. Choose a built-in type or define your own in Configure with a reusable shape or glTF/GLB model.</p><div id="catalog-grid" class="catalog-grid"></div>
    <div class="dialog-bottom"><span>Omit <code>type</code> to use a container.</span><button data-close="catalog" class="primary">Back to explorer</button></div>
  </dialog>
  <dialog id="presets" aria-labelledby="presets-title">
    <div class="dialog-heading"><span class="eyebrow">A PLACE TO START</span><button data-close="presets" aria-label="Close presets">×</button></div>
    <h2 id="presets-title">Real patterns. Your perspective.</h2>
    <p>Infrastructure patterns, an Umbraco repository snapshot, and business and workflow examples. Open a preset, make it yours, then apply it. Your current architecture stays active until you apply the draft.</p>
    <div id="preset-error" class="error" role="alert"></div>
    <label class="type-filter">Category<select id="preset-category" aria-label="Preset category"></select></label>
    <div id="preset-grid" class="preset-grid"></div>
    <div class="dialog-bottom"><span>All presets use the same editable version 1 format.</span><button data-close="presets">Back to explorer</button></div>
  </dialog>
  <dialog id="spaces-dialog" aria-labelledby="spaces-title">
    <div class="dialog-heading"><span class="eyebrow">OUTSIDE AND INSIDE</span><button data-close="spaces-dialog" aria-label="Close spaces">×</button></div>
    <h2 id="spaces-title">Your spaces.</h2><p>Choose spaces to show together, or view one alone. Link an object to a space in its inspector to open that space when clicked.</p>
    <div id="space-list"></div><button id="spaces-show-all">Show all spaces together</button>
    <form id="space-create-form">
      <h3>Add a space</h3>
      <label class="property-field">Name<input id="space-create-name" required maxlength="100" placeholder="Home, office, inside the shop…" /></label>
      <label class="property-field">Start with<select id="space-create-mode"><option value="blank">Blank space</option><option value="template">A preset template</option><option value="duplicate">Duplicate an existing space</option></select></label>
      <label id="space-source-label" class="property-field" hidden>Source<select id="space-create-source"></select></label>
      <p class="muted">Templates add their spaces and contents. Duplicates copy one space and its internal connectors. Existing spaces stay in this document.</p>
      <div id="spaces-error" class="error" role="alert"></div><button id="space-create-button" class="primary" type="submit">Create space ↗</button>
    </form>
  </dialog>
`;
