/*
 * site.js — shared client-side script for the quikdown site.
 *
 * Handles:
 *   - Theme cycling (auto → light → dark) persisted in localStorage
 *   - Copy-to-clipboard buttons (data-copy="text to copy")
 *   - Code tab switcher (data-tab-trigger / data-tab-target)
 *   - Active nav link highlighting based on the current path
 *
 * No frameworks. Pure vanilla. ~150 lines.
 */

(function () {
    'use strict';

    // ----- Theme cycling -----
    // Default is dark; cycle dark → light → auto → dark
    const THEMES = ['qd-theme-dark', 'qd-theme-light', 'qd-theme-auto'];
    const ICONS  = { 'qd-theme-dark': '🌙', 'qd-theme-light': '☀️', 'qd-theme-auto': '🖥️' };
    const STORAGE_KEY = 'quikdown-site-theme';
    const DEFAULT_THEME = 'qd-theme-light';

    function applyTheme(theme) {
        document.body.classList.remove(...THEMES);
        document.body.classList.add(theme);
        const icon = document.getElementById('qd-theme-icon');
        if (icon) icon.textContent = ICONS[theme] || '🌙';
        // Broadcast to any embedded iframes that listen for theme changes
        // (e.g. the mini editor on the landing page)
        const themeName = theme === 'qd-theme-dark' ? 'dark'
                       : theme === 'qd-theme-light' ? 'light'
                       : 'auto';
        document.querySelectorAll('iframe').forEach((f) => {
            try {
                if (f.contentWindow) {
                    f.contentWindow.postMessage({ type: 'qd-theme', theme: themeName }, '*');
                }
            } catch (_e) { /* cross-origin — ignore */ }
        });
    }

    function initTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        const theme = THEMES.includes(stored) ? stored : DEFAULT_THEME;
        applyTheme(theme);

        const btn = document.getElementById('qd-theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const current = THEMES.find(t => document.body.classList.contains(t)) || DEFAULT_THEME;
            const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
            localStorage.setItem(STORAGE_KEY, next);
            applyTheme(next);
        });
    }

    // ----- Copy to clipboard -----
    function initCopyButtons() {
        document.querySelectorAll('[data-copy]').forEach((el) => {
            el.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const text = el.dataset.copy;
                try {
                    await navigator.clipboard.writeText(text);
                    el.classList.add('copied');
                    const original = el.textContent;
                    if (el.dataset.copiedLabel) {
                        el.textContent = el.dataset.copiedLabel;
                    }
                    setTimeout(() => {
                        el.classList.remove('copied');
                        if (el.dataset.copiedLabel) el.textContent = original;
                    }, 1500);
                } catch (_e) {
                    // Clipboard blocked — fall back to selection
                    const range = document.createRange();
                    const tmp = document.createElement('span');
                    tmp.textContent = text;
                    document.body.appendChild(tmp);
                    range.selectNode(tmp);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                    setTimeout(() => {
                        tmp.remove();
                        window.getSelection().removeAllRanges();
                    }, 1500);
                }
            });
        });
    }

    // ----- Code tab switcher -----
    function initTabs() {
        document.querySelectorAll('.qd-tabs').forEach((wrap) => {
            const buttons = wrap.querySelectorAll('.qd-tab-btn');
            const panes   = wrap.querySelectorAll('.qd-tab-pane');
            buttons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.tabTarget;
                    buttons.forEach(b => b.classList.toggle('active', b === btn));
                    panes.forEach(p => p.classList.toggle('active', p.dataset.tabPane === target));
                });
            });
        });
    }

    // ----- Hamburger nav toggle -----
    function initNavToggle() {
        var toggle = document.getElementById('qd-nav-toggle');
        var nav = toggle && toggle.closest('.qd-nav');
        if (!toggle || !nav) return;
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });
        nav.addEventListener('click', function (e) {
            if (e.target.closest('.qd-nav-link')) {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ----- Active nav highlighting -----
    function initNavActive() {
        // Determine current page from path
        const path = window.location.pathname;
        let current = 'home';
        if (path.includes('/edit/'))           current = 'edit';
        else if (path.includes('/examples/'))  current = 'examples';
        else if (path.includes('/docs/'))      current = 'docs';
        else if (path.includes('/changelog/')) current = 'changelog';
        else if (path.includes('/downloads/')) current = 'downloads';
        else if (path.includes('/frameworks/')) current = 'frameworks';

        document.querySelectorAll('.qd-nav-link[data-nav]').forEach((link) => {
            link.classList.toggle('active', link.dataset.nav === current);
        });
    }

    // ----- Init on DOM ready -----
    function init() {
        initTheme();
        initCopyButtons();
        initTabs();
        initNavToggle();
        initNavActive();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
