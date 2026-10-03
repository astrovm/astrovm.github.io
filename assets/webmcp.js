(function() {
  if (typeof navigator === 'undefined' || !navigator.modelContext) return;

  var ctrl = new AbortController();

  function registerTool(name, description, inputSchema, execute) {
    try {
      navigator.modelContext.registerTool({ name: name, description: description, inputSchema: inputSchema, execute: execute }, { signal: ctrl.signal });
    } catch (e) {
      console.warn('WebMCP: failed to register tool', name, e);
    }
  }

  registerTool('navigate', 'Navigate to a page on this site', {
    type: 'object',
    properties: { path: { type: 'string', description: 'Relative path like /projects/ or /blog/' } },
    required: ['path']
  }, function(args) {
    window.location.href = args.path;
    return { navigated: args.path };
  });

  registerTool('list_pages', 'List all pages on 4st.li', { type: 'object', properties: {} }, function() {
    return { pages: ['/', '/projects/', '/configs/', '/contact/', '/blog/tronlink-wallet-recovery/', '/blog/invertir-en-vos/', '/blog/half-life/'] };
  });

  registerTool('get_site_info', 'Get information about 4st.li and its author', { type: 'object', properties: {} }, function() {
    return {
      site: '4st.li',
      author: 'astro',
      github: 'https://github.com/astrovm',
      description: 'Personal website about crypto, programming, Linux, and hacking',
      projects: ['Amy OS', 'Adventure Mods', 'Crosstune', 'YTMusicFS', 'Timba', 'Flash Collection'],
      contact: { email: '~@4st.li', signal: 'astro.99', telegram: '@astrolince' }
    };
  });

  registerTool('play_with_cat', 'Play with the pixel cat that lives on the page', {
    type: 'object',
    properties: { action: { type: 'string', enum: ['pet', 'treat', 'yarn', 'hunt', 'box', 'nyan', 'call'] } },
    required: ['action']
  }, function(args) {
    var cat = window.oneko;
    var actions = { pet: 'pet', treat: 'treat', yarn: 'play', hunt: 'hunt', box: 'box', nyan: 'nyan', call: 'pspsps' };
    if (!cat || !actions[args.action]) return { played: false };
    cat[actions[args.action]]();
    return { played: args.action };
  });

  window.addEventListener('beforeunload', function() { ctrl.abort(); });
})();
