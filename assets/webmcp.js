(function() {
  if (typeof document === 'undefined') return;
  // The spec moved the API to document. Older Chrome builds still have it on navigator.
  var context = document.modelContext || navigator.modelContext;
  if (!context) return;

  // Pages and projects come from Hugo (extended_head.html), so they always match the site.
  var site = window.__WEBMCP__ || { pages: [], projects: [] };
  var ctrl = new AbortController();
  var readOnly = { readOnlyHint: true };

  function registerTool(name, description, inputSchema, execute, annotations) {
    function failed(e) {
      console.warn('WebMCP: failed to register tool', name, e);
    }
    try {
      var tool = { name: name, description: description, inputSchema: inputSchema, execute: execute };
      if (annotations) tool.annotations = annotations;
      var registered = context.registerTool(tool, { signal: ctrl.signal });
      if (registered && registered.catch) registered.catch(failed);
    } catch (e) {
      failed(e);
    }
  }

  registerTool('navigate', 'Navigate to a page on this site', {
    type: 'object',
    properties: { path: { type: 'string', description: 'Path from list_pages, like /en/projects/' } },
    required: ['path']
  }, function(args) {
    // Only pages on this site, so nothing can send it to another site or a javascript: link.
    var url = new URL(args.path, location.href);
    if (url.origin !== location.origin) return { navigated: false };
    window.location.href = url.pathname + url.search + url.hash;
    return { navigated: url.pathname };
  });

  registerTool('list_pages', 'List all pages on 4st.li in the current language', { type: 'object', properties: {} }, function() {
    return { pages: site.pages };
  }, readOnly);

  registerTool('get_site_info', 'Get information about 4st.li, its author and their projects', { type: 'object', properties: {} }, function() {
    return {
      site: '4st.li',
      author: 'astro',
      github: 'https://github.com/astrovm',
      description: 'Personal website about crypto, programming, Linux, and hacking',
      projects: site.projects,
      contact: { email: '~@4st.li', signal: 'astro.99', telegram: '@astrolince' }
    };
  }, readOnly);

  // Tool action -> window.oneko method. The cat says no (false) when there's nothing around to do it with.
  var tricks = {
    pet: 'pet', treat: 'treat', yarn: 'play', call: 'pspsps', nyan: 'nyan', hunt: 'hunt', box: 'box', pounce: 'pounce',
    nap: 'nap', scratch: 'scratch', perch: 'perch', peek: 'peek', bite: 'bite', knock: 'knock', push: 'push', steal: 'steal'
  };

  registerTool('play_with_cat', 'Play with the pixel cat that lives on the page. ' +
    'yarn throws a ball of yarn, call calls it over, hunt sends a butterfly, box drops a box to sit in, ' +
    'pounce leaps at the cursor, nap sleeps on a paragraph, scratch scratches the screen edge, perch sits on something, ' +
    'peek peeks over a picture, bite bites a chunk out of something, knock tilts something, push shoves something, steal takes a word.', {
    type: 'object',
    properties: { action: { type: 'string', enum: Object.keys(tricks) } },
    required: ['action']
  }, function(args) {
    var cat = window.oneko;
    if (!cat || !tricks[args.action]) return { played: false };
    if (cat[tricks[args.action]]() === false) return { played: false };
    return { played: args.action };
  });

  window.addEventListener('beforeunload', function() { ctrl.abort(); });
})();
