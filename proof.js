// Real-proof section: company facts, job photos and customer reviews.
// Everything comes from proof.json. While that file's lists are empty the whole section
// stays hidden, so the page never shows empty boxes or invented content.
//
//   facts   : [{ "label": "Fully insured", "detail": "Goods in transit cover" }]
//   photos  : [{ "src": "photos/van-1.jpg", "alt": "Our van outside a flat in Hackney", "caption": "optional" }]
//   reviews : [{ "name": "Sarah K.", "area": "Hackney", "text": "...", "stars": 5, "source": "Google" }]
(function () {
  'use strict';
  var section = document.getElementById('proof');
  if (!section) return;

  var PHOTO_OK = /^photos\/[\w\-. ]+\.(jpe?g|png|webp|avif)$/i;
  var text = function (v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  };

  fetch('proof.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) render(data); })
    .catch(function () { /* no data: the section simply stays hidden */ });

  function render(data) {
    var shown = 0;

    // company facts (only ever what the owner has confirmed)
    var facts = (Array.isArray(data.facts) ? data.facts : []).filter(function (f) { return f && text(f.label, 80); });
    if (facts.length) {
      var list = section.querySelector('.proof-facts');
      facts.forEach(function (f) {
        var li = el('li');
        var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'icon');
        icon.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#i-check');
        icon.appendChild(use);
        var body = el('span');
        body.appendChild(el('strong', '', text(f.label, 80)));
        if (text(f.detail, 120)) body.appendChild(el('small', '', text(f.detail, 120)));
        li.append(icon, body);
        list.appendChild(li);
      });
      list.hidden = false;
      shown++;
    }

    // job photos, opening in a larger view
    var photos = (Array.isArray(data.photos) ? data.photos : []).filter(function (p) {
      return p && typeof p.src === 'string' && PHOTO_OK.test(p.src);
    });
    if (photos.length) {
      var block = document.getElementById('proof-photos');
      var grid = block.querySelector('.gallery');
      photos.forEach(function (p) {
        var btn = el('button', 'shot');
        btn.type = 'button';
        var alt = text(p.alt, 160) || 'Shift & Settle at work';
        btn.setAttribute('aria-label', 'Enlarge photo: ' + alt);
        var img = el('img');
        img.src = p.src; img.alt = alt; img.loading = 'lazy'; img.decoding = 'async';
        btn.appendChild(img);
        if (text(p.caption, 120)) btn.appendChild(el('span', 'cap', text(p.caption, 120)));
        btn.addEventListener('click', function () { openPhoto(p.src, alt, text(p.caption, 120)); });
        grid.appendChild(btn);
      });
      block.hidden = false;
      shown++;
    }

    // reviews from real customers
    var reviews = (Array.isArray(data.reviews) ? data.reviews : []).filter(function (r) {
      return r && text(r.text, 600) && text(r.name, 60);
    });
    if (reviews.length) {
      var rblock = document.getElementById('proof-reviews');
      var rgrid = rblock.querySelector('.reviews');
      reviews.forEach(function (r) {
        var card = el('figure', 'review');
        var stars = Math.max(0, Math.min(5, parseInt(r.stars, 10) || 0));
        if (stars) {
          var s = el('div', 'stars', '★★★★★'.slice(0, stars));
          s.setAttribute('role', 'img');
          s.setAttribute('aria-label', stars + ' out of 5 stars');
          card.appendChild(s);
        }
        var q = el('blockquote', '', text(r.text, 600));
        var who = [text(r.name, 60), text(r.area, 60)].filter(Boolean).join(', ');
        var cap = el('figcaption');
        cap.appendChild(el('strong', '', who));
        if (text(r.source, 40)) cap.appendChild(el('small', '', text(r.source, 40) + ' review'));
        card.append(q, cap);
        rgrid.appendChild(card);
      });
      rblock.hidden = false;
      shown++;
    }

    if (shown) section.hidden = false;
  }

  // simple larger view using the browser's own dialog element
  function openPhoto(src, alt, caption) {
    var dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') { window.open(src, '_blank', 'noopener'); return; }
    var img = dlg.querySelector('img');
    img.src = src; img.alt = alt;
    dlg.querySelector('.lb-cap').textContent = caption;
    dlg.showModal();
  }
  var dlg = document.getElementById('lightbox');
  if (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.lb-close')) dlg.close(); });
  }
})();
