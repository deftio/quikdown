/*
 * example-mount.js — nav + footer for pages under examples/
 *
 * Usage (from examples/foo/index.html):
 *   <div id="qd-nav-mount"></div>
 *   ...
 *   <div id="qd-footer-mount"></div>
 *   <script src="../scripts/example-mount.js" defer></script>
 */
(function () {
  'use strict';

  var scriptSrc = document.currentScript && document.currentScript.src;
  var scriptsDir = scriptSrc
    ? scriptSrc.substring(0, scriptSrc.lastIndexOf('/') + 1)
    : '';
  var examplesBase = scriptsDir + '../';

  function repoRoot() {
    var segments = window.location.pathname.replace(/\/[^/]*$/, '').split('/').filter(Boolean);
    var exIdx = segments.indexOf('examples');
    if (exIdx < 0) return '..';
    var depth = segments.length - exIdx;
    var parts = [];
    for (var i = 0; i < depth; i++) parts.push('..');
    return parts.join('/') || '.';
  }

  function mount() {
    var navEl = document.getElementById('qd-nav-mount');
    var footerEl = document.getElementById('qd-footer-mount');
    if (!navEl || !footerEl) return;

    var root = repoRoot();
    var pagesBase = root + '/pages/';

    Promise.all([
      fetch(pagesBase + 'components/nav.html').then(function (r) { return r.text(); }),
      fetch(pagesBase + 'components/footer.html').then(function (r) { return r.text(); }),
      fetch(pagesBase + 'version.json').then(function (r) { return r.json(); }).catch(function () { return { version: '?' }; }),
    ]).then(function (results) {
      var nav = results[0];
      var footer = results[1];
      var info = results[2];
      var version = info.version || '?';

      function replacers(s) {
        return s
          .replace(/\{\{ROOT\}\}/g, root)
          .replace(/\{\{VERSION\}\}/g, version)
          .replace(/\{\{COVERAGE\}\}/g, info.coverage || '?')
          .replace(/\{\{SIZE_CORE\}\}/g, info.sizeCore || '?')
          .replace(/\{\{SIZE_BD\}\}/g, info.sizeBd || '?')
          .replace(/\{\{SIZE_EDIT\}\}/g, info.sizeEdit || '?');
      }

      navEl.outerHTML = replacers(nav);
      footerEl.outerHTML = replacers(footer);

      var s = document.createElement('script');
      s.src = pagesBase + 'scripts/site.js';
      document.body.appendChild(s);
    }).catch(function (e) {
      console.error('example-mount.js: failed to mount nav/footer', e);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
