// Hugo still serves every URL. JS keeps the cat and terminal alive between pages.
(function () {
  if (!window.fetch || !window.history?.pushState) return;
  let pending;
  let sequence = 0;
  const position = () => ({ x: window.scrollX, y: window.scrollY });
  const remember = () => history.replaceState({ ...history.state, site: true, scroll: position() }, '', location.href);
  history.scrollRestoration = 'manual';
  remember();
  window.addEventListener('scroll', () => {
    if (!pending) remember();
  }, { passive: true });

  function scroll(url, saved) {
    if (saved) {
      window.scrollTo(saved.x, saved.y);
    } else if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }

  async function navigate(url, { pop = false, saved } = {}) {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const turn = ++sequence;
    const content = document.querySelector('.content');
    content.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url.href, { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page unavailable');
      const destination = new URL(response.url);
      if (destination.origin !== location.origin) throw new Error('External redirect');
      destination.hash = url.hash;
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextContent = page.querySelector('.content');
      const nextHeader = page.querySelector('.header');
      if (!nextContent || !nextHeader) throw new Error('Not a site page');
      if (turn !== sequence) return;
      if (!pop) {
        remember();
        history.pushState({ site: true }, '', destination.href);
      } else if (destination.href !== url.href) {
        history.replaceState({ ...history.state }, '', destination.href);
      }
      document.documentElement.lang = page.documentElement.lang;
      document.querySelector('.header').replaceWith(nextHeader);
      content.replaceChildren(...nextContent.childNodes);
      // Keep the terminal's title prompt intact. Refresh page metadata only.
      const metadata = 'meta[name="description"], meta[name="keywords"], meta[name="robots"], meta[property^="og:"], meta[property^="article:"], link[rel="canonical"], link[rel="alternate"]';
      document.head.querySelectorAll(metadata).forEach((el) => el.remove());
      page.head.querySelectorAll(metadata).forEach((el) => document.head.append(el));
      const scripts = [...content.querySelectorAll('script')];
      scripts.forEach((script) => script.remove());
      window.dispatchEvent(new Event('site:navigate'));
      // Only the site's comment embed needs to run inside fetched content.
      scripts.filter((script) => script.src === 'https://utteranc.es/client.js').forEach((script) => {
        const embed = document.createElement('script');
        [...script.attributes].forEach((attr) => embed.setAttribute(attr.name, attr.value));
        content.querySelector('.post')?.append(embed);
      });
      scroll(destination, saved);
      const heading = content.querySelector('h1, h2') || content;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      pending = null;
      remember();
    } catch (error) {
      if (error.name !== 'AbortError' && turn === sequence) location.assign(url.href);
    } finally {
      if (turn === sequence) {
        content.removeAttribute('aria-busy');
        pending = null;
      }
    }
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !/^\/(en|es|ja|zh)(\/|$)/.test(url.pathname) || /\.[^/]+$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (pending) {
        pending.abort();
        pending = null;
        sequence += 1;
        document.querySelector('.content').removeAttribute('aria-busy');
      }
      return;
    }
    event.preventDefault();
    void navigate(url);
  });
  window.addEventListener('popstate', (event) => {
    void navigate(new URL(location.href), { pop: true, saved: event.state?.scroll });
  });
})();
