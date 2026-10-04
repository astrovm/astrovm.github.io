// Rebind page controls after navigation without stacking listeners.
(function () {
  let controller;
  function init() {
    controller?.abort();
    controller = new AbortController();
    const listen = (el, name, fn) => el.addEventListener(name, fn, { signal: controller.signal });
    const menus = [...document.querySelectorAll('.menu')];
    const close = () => menus.forEach((menu) => menu.classList.remove('open'));
    listen(document.body, 'click', close);
    listen(window, 'resize', close);
    menus.forEach((menu) => {
      const trigger = menu.querySelector('.menu__trigger');
      const dropdown = menu.querySelector('.menu__dropdown');
      if (!trigger || !dropdown) return;
      listen(trigger, 'click', (event) => {
        event.stopPropagation();
        const open = !menu.classList.contains('open');
        close();
        menu.classList.toggle('open', open);
        if (dropdown.getBoundingClientRect().right > document.querySelector('.container').getBoundingClientRect().right) {
          dropdown.style.left = 'auto';
          dropdown.style.right = '0';
        }
      });
      listen(dropdown, 'click', (event) => event.stopPropagation());
    });
    document.querySelectorAll('.chroma code[data-lang]').forEach((code) => {
      const highlight = code.closest('.highlight');
      if (!highlight || highlight.querySelector('.code-title')) return;
      const title = document.createElement('div');
      title.className = 'code-title';
      title.textContent = code.dataset.lang;
      if (navigator.clipboard) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-button';
        button.textContent = 'Copy';
        listen(button, 'click', async () => {
          try {
            await navigator.clipboard.writeText(code.innerText);
            button.textContent = 'Copied';
          } catch {
            button.textContent = 'Copy failed';
          }
          setTimeout(() => { button.textContent = 'Copy'; }, 1000);
        });
        title.append(button);
      }
      highlight.prepend(title);
    });

  }
  window.addEventListener('site:navigate', init);
  init();
})();
