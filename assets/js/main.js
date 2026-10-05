/* ============================================================
   ВИЗУАЛЬНЫЙ АВТОР — интерактив v1
   ============================================================ */
(function () {
  'use strict';

  var S = window.SITE || { contacts: {}, cta: {}, form: {}, analytics: {} };
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 1. Тост ---------- */
  var toastEl, toastTimer;
  function toast(html, icon) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<i>' + (icon || '!') + '</i><span>' + html + '</span>';
    toastEl.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-shown'); }, 4200);
  }

  /* ---------- 2. Ссылки-кнопки ----------
     Адрес подставляет СЕРВЕР (Jinja берёт его из content.json).
     Здесь только ловим клик по незаполненной кнопке: у неё
     href="#", aria-disabled и data-unset="<ключ>" — показываем
     подсказку, что ключ надо заполнить в content.json. */
  function bindCtas() {
    $$('[data-unset]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (el.tagName !== 'A' && el.tagName !== 'BUTTON') return;
        e.preventDefault();
        var key = el.getAttribute('data-unset');
        var label = key === 'page' ? 'этот раздел' : 'ссылка «' + key + '»';
        toast('Пока не заполнена ' + label + ' — укажите её в <b>content.json</b>', '→');
      });
    });
  }

  /* ---------- 3. Шапка ---------- */
  function stickyHeader() {
    var header = $('#header');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 12);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function mobileMenu() {
    var burger = $('#burger'), nav = $('#nav');
    if (!burger || !nav) return;
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 4. Появление при скролле ---------- */
  function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + 'ms';
      io.observe(el);
    });
  }

  /* ---------- 5. Счётчики ---------- */
  function counters() {
    var els = $$('[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;

    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dur = 1500, t0 = null;
      var step = function (t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: .5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 6. Табы ---------- */
  function tabs() {
    $$('[data-tabs]').forEach(function (group) {
      var btns = $$('.tab', group);
      var panels = $$('[data-panel="' + group.getAttribute('data-tabs') + '"]');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-tab');
          btns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === id); });
        });
      });
    });
  }

  /* ---------- 7. Аккордеон ---------- */
  function accordions() {
    $$('.acc').forEach(function (acc) {
      $$('.acc__btn', acc).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest('.acc__item');
          var isOpen = item.classList.contains('is-open');
          if (acc.hasAttribute('data-single') && !isOpen) {
            $$('.acc__item.is-open', acc).forEach(function (i) {
              i.classList.remove('is-open');
              $('.acc__btn', i).setAttribute('aria-expanded', 'false');
            });
          }
          item.classList.toggle('is-open', !isOpen);
          btn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
        });
      });
    });
  }

  /* ---------- 8. Фильтр кейсов ---------- */
  function filters() {
    $$('[data-filters]').forEach(function (group) {
      var targetSel = group.getAttribute('data-filters');
      var btns = $$('.filter', group);
      var items = $$('[data-cat="' + targetSel + '"]');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cat = btn.getAttribute('data-filter');
          btns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          items.forEach(function (item) {
            var show = cat === 'all' || item.getAttribute('data-cat-value') === cat;
            item.classList.toggle('is-hidden', !show);
          });
        });
      });
    });
  }

  /* ---------- 9. Формы ---------- */
  function forms() {
    $$('form[data-form]').forEach(function (form) {
      var ok = $('.form-ok', form);

      var validate = function (input) {
        var v = (input.value || '').trim();
        var bad = false;
        if (input.hasAttribute('required') && !v) bad = true;
        if (!bad && input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) bad = true;
        input.classList.toggle('is-bad', bad);
        var err = input.parentNode.querySelector('.field__err');
        if (err) {
          err.textContent = bad
            ? (!v && input.hasAttribute('required') ? 'Заполните поле' : 'Проверьте адрес почты')
            : '';
        }
        return !bad;
      };

      $$('.field input, .field textarea, .field select', form).forEach(function (input) {
        input.addEventListener('blur', function () { validate(input); });
        input.addEventListener('input', function () { if (input.classList.contains('is-bad')) validate(input); });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fields = $$('.field input, .field textarea, .field select', form);
        var valid = true;
        var first = null;
        fields.forEach(function (f) {
          if (!validate(f)) { valid = false; if (!first) first = f; }
        });

        var consent = form.querySelector('input[type="checkbox"][required]');
        if (consent && !consent.checked) {
          valid = false;
          toast('Нужно согласие на обработку данных', '⚠');
        }

        if (!valid) {
          if (first) first.focus();
          else toast('Проверьте заполненные поля', '⚠');
          return;
        }

        var data = {};
        fields.forEach(function (f) { data[f.name || f.id] = f.value; });
        data.consent = consent && consent.checked ? '1' : '';

        var btn = form.querySelector('button[type="submit"]');
        var status = $('.form__status', form);
        var say = function (text, bad) {
          if (!status) { if (bad) toast(text, '⚠'); return; }
          status.textContent = text;
          status.classList.toggle('is-bad', !!bad);
          status.classList.add('is-shown');
        };
        if (status) status.classList.remove('is-shown');
        if (btn) btn.setAttribute('disabled', 'disabled');
        say('Отправляем…');

        // Заявка уходит на Flask (/api/lead) — он сохранит её в data/leads.json.
        // Если в content.json указан form.endpoint, сервер отдаст её туда.
        fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
          .then(function (r) {
            return r.json().then(function (j) { return { ok: r.ok, body: j }; });
          })
          .then(function (res) {
            if (res.ok && res.body && res.body.ok) {
              say('Заявка принята. Отвечу в течение рабочего дня.', false);
              if (ok) ok.classList.add('is-shown');
              form.reset();
              setTimeout(function () { if (ok) ok.classList.remove('is-shown'); }, 9000);
            } else {
              say((res.body && res.body.error) || 'Не удалось отправить заявку', true);
            }
          })
          .catch(function () {
            say('Сервер недоступен. Проверьте, работает ли python3 app.py', true);
          })
          .then(function () { if (btn) btn.removeAttribute('disabled'); });
      });
    });
  }

  /* ---------- 10. Подсветка активного пункта ----------
     Сервер уже ставит is-active на нужной ссылке (Jinja знает
     текущую страницу). Здесь лишь подстраховка для якорных
     переходов внутри главной. */
  function activeNav() {
    var here = document.body.getAttribute('data-page');
    if (!here) return;
    $$('#nav a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/\/$/, '') || 'index';
      if (href.replace(/^\//, '') === here) a.classList.add('is-active');
    });
  }

  /* ---------- 11. Копирование промпта ---------- */
  function copyBlocks() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-copy');
        var node = src && src.charAt(0) === '#' ? $(src) : null;
        var text = node ? (node.getAttribute('data-text') || node.textContent) : (src || '');
        text = text.trim();
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast('Скопировано в буфер обмена', '✓');
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); toast('Скопировано в буфер обмена', '✓'); }
          catch (err) { toast('Не удалось скопировать', '⚠'); }
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ---------- 12. Плавная прокрутка по якорям ---------- */
  function anchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  }

  /* ---------- 13. Аналитика (если задана) ---------- */
  function analytics() {
    var a = S.analytics || {};
    if (a.yandexMetrikaId) {
      (function (m, e, t, i, k) {
        m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
        m[k].id = a.yandexMetrikaId; t.appendChild(e);
      })(window, document.createElement('script'), document.createElement('div'), 'ym', 'Metrika');
      window.ym(a.yandexMetrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
    }
    if (a.ga4Id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + a.ga4Id;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', a.ga4Id);
    }
  }

  /* ---------- 14. Showcase ---------- */
  function showcase() {
    var root = $('[data-showcase]');
    if (!root) return;

    var cards = $$('.showcase__card', root);
    if (cards.length < 2) return;

    var dotsBox = $('.showcase__dots', root);
    var head = $('[data-show-title]', root);
    var text = $('[data-show-text]', root);
    var tags = $('[data-show-tags]', root);
    var counter = $('[data-show-n]', root);

    var DATA = [];
    cards.forEach(function (c) {
      DATA.push({
        title: (c.getAttribute('data-title') || '').trim(),
        text:  (c.getAttribute('data-text') || '').trim(),
        tags:  (c.getAttribute('data-tags') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean)
      });
    });

    var i = 0, timer = null, playing = true, DELAY = 4200;

    function buildDots() {
      if (!dotsBox) return;
      dotsBox.innerHTML = '';
      cards.forEach(function (_, n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Проект ' + (n + 1));
        b.addEventListener('click', function () { show(n); restart(); });
        dotsBox.appendChild(b);
      });
    }

    function show(n) {
      i = (n + cards.length) % cards.length;
      cards.forEach(function (c, k) {
        c.setAttribute('data-pos', String((k - i + cards.length) % cards.length));
      });
      var d = DATA[i];
      if (head && d) head.textContent = d.title;
      if (text && d) text.textContent = d.text;
      if (tags && d) {
        tags.innerHTML = '';
        d.tags.forEach(function (t) {
          var s = document.createElement('span');
          s.textContent = t;
          tags.appendChild(s);
        });
      }
      if (counter) counter.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
      if (dotsBox) {
        $$('button', dotsBox).forEach(function (b, k) { b.classList.toggle('on', k === i); });
      }
    }

    function restart() {
      clearTimeout(timer);
      if (playing) timer = setTimeout(function () { show(i + 1); }, DELAY);
    }

    var prev = $('[data-show-prev]', root);
    var next = $('[data-show-next]', root);
    if (prev) prev.addEventListener('click', function () { show(i - 1); restart(); });
    if (next) next.addEventListener('click', function () { show(i + 1); restart(); });

    root.addEventListener('mouseenter', function () { playing = false; clearTimeout(timer); });
    root.addEventListener('mouseleave', function () { playing = true; restart(); });

    buildDots();
    show(0);
    restart();
  }

  /* ---------- 15. Витрина нейросетей ----------
     Карточки уже нарисованы сервером из content.json.
     Здесь только логика карусели и фильтр по категориям:
     скрываем ненужные карточки, а не создаём их заново. */
  function vitrine() {
    var root = $('[data-vitrine]');
    if (!root) return;

    var track = $('.vitrine__track', root);
    var viewport = $('.vitrine__viewport', root);
    var dotsBox = $('.vitrine__dots', root);
    var prevBtn = $('[data-vit-prev]', root);
    var nextBtn = $('[data-vit-next]', root);
    var counter = $('[data-vit-count]', root);
    if (!track) return;

    var all = $$('.svc', track);          // все карточки, с сервера
    if (!all.length) return;

    var items = all.slice();
    var idx = 0;          // индекс первого видимого элемента
    var playing = true;
    var timer = null;
    var DELAY = 5000;
    var GAP = 28;

    function perView() {
      if (viewport.clientWidth < 560) return 1;
      if (viewport.clientWidth < 900) return 2;
      return 3;
    }

    function steps() {
      var n = perView();
      return Math.max(1, items.length - n + 1);
    }

    /* Переносит нужные карточки в начало трека и прячет остальные.
       Порядок в разметке не меняется — это важно для доступности. */
    function render() {
      all.forEach(function (el) { el.classList.add('is-hidden'); });
      items.forEach(function (el) { el.classList.remove('is-hidden'); });
      idx = Math.min(idx, steps() - 1);
      sync();
      dots();
    }

    function offset() {
      var cards = track.querySelectorAll('.svc');
      if (!cards.length) return 0;
      var w = cards[0].getBoundingClientRect().width;
      var g = 0;
      try { g = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0; }
      catch (e) { g = GAP; }
      if (!g) g = GAP;
      return idx * (w + g);
    }

    function sync() {
      var max = offset();
      track.style.transform = 'translate3d(' + (-max) + 'px,0,0)';

      var n = perView();
      var cards = track.querySelectorAll('.svc');
      for (var i = 0; i < cards.length; i++) {
        if (i < n && idx + i < items.length) cards[i].classList.add('is-current');
        else cards[i].classList.remove('is-current');
      }

      if (counter) {
        counter.innerHTML = '<b>' + String(Math.min(idx + 1, items.length)) + '</b> / ' + items.length;
      }
      if (catLabel) {
        catLabel.textContent = root.getAttribute('data-vit-label') || '';
      }
      if (dotsBox) markDot();
      restart();
    }

    function dots() {
      if (!dotsBox) return;
      dotsBox.innerHTML = '';
      var n = steps();
      for (var i = 0; i < n; i++) {
        (function (i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Перейти к позиции ' + (i + 1));
          b.addEventListener('click', function () { idx = i; sync(); });
          dotsBox.appendChild(b);
        })(i);
      }
      markDot();
    }

    function markDot() {
      if (!dotsBox) return;
      $$('button', dotsBox).forEach(function (b, i) {
        b.classList.toggle('on', i === idx);
      });
    }

    function go(d) {
      var next = idx + d;
      if (next < 0) next = steps() - 1;
      if (next > steps() - 1) next = 0;
      idx = next;
      sync();
    }

    function restart() {
      clearTimeout(timer);
      root.classList.remove('is-playing');
      // перезапуск CSS-анимации прогресса
      void root.offsetWidth;
      if (playing) {
        timer = setTimeout(function () { go(1); }, DELAY);
        root.classList.add('is-playing');
      }
    }

    function setPlaying(on) {
      playing = on;
      restart();
    }


    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });

    // Пауза при наведении и фокусе
    root.addEventListener('mouseenter', function () { setPlaying(false); });
    root.addEventListener('mouseleave', function () { setPlaying(true); });
    root.addEventListener('focusin', function () { setPlaying(false); });

    // Клавиатура
    if (viewport) {
      viewport.setAttribute('tabindex', '0');
      viewport.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
      });
    }

    // Свайп на телефоне
    if (viewport) {
      var x0 = null, y0 = null;
      viewport.addEventListener('touchstart', function (e) {
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
        setPlaying(false);
      }, { passive: true });
      viewport.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        var dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        x0 = null; y0 = null;
        setPlaying(true);
      }, { passive: true });
    }

    // Фильтр по категории: data-cat-value проставлен шаблоном
    $$('[data-vit-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-vit-filter');
        $$('[data-vit-filter]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        items = (cat === 'all')
          ? all.slice()
          : all.filter(function (el) { return el.getAttribute('data-cat-value') === cat; });
        idx = 0;
        render();
      });
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { idx = Math.min(idx, steps() - 1); sync(); }, 180);
    });

    render();
  }

  /* ---------- 19. Инициализация ---------- */
  function init() {
    bindCtas();
    stickyHeader();
    mobileMenu();
    reveal();
    counters();
    tabs();
    accordions();
    filters();
    forms();
    activeNav();
    copyBlocks();
    anchors();
    showcase();
    vitrine();
    analytics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();