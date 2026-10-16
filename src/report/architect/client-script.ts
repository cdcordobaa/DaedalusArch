/**
 * Inline browser script of the architect HTML report: the tier, rule, layer, file and edge filters. Plain ES2017,
 * no library. Without JavaScript every finding stays visible.
 */
export const ARCHITECT_CLIENT_SCRIPT = `
(function () {
  'use strict';
  var cards = Array.prototype.slice.call(document.querySelectorAll('.finding'));
  if (cards.length === 0) return;
  var byId = function (id) { return document.getElementById(id); };
  var rule = byId('f-rule'), layer = byId('f-layer'), file = byId('f-file');
  var count = byId('f-count'), empty = byId('f-empty'), edgeNote = byId('f-edge'), clear = byId('f-clear');
  var tierBoxes = Array.prototype.slice.call(document.querySelectorAll('[data-filter-tier]'));
  var layerBoxes = Array.prototype.slice.call(document.querySelectorAll('.layer[data-layer]'));
  var edgeGroups = Array.prototype.slice.call(document.querySelectorAll('.edge[data-edge][tabindex]'));
  var edge = '';
  var has = function (list, value) { return list.split('|').indexOf(value) >= 0; };

  function apply() {
    var tiers = {};
    tierBoxes.forEach(function (b) { tiers[b.getAttribute('data-filter-tier')] = b.checked; });
    var shown = 0;
    cards.forEach(function (c) {
      var ok = tiers[c.getAttribute('data-tier')] === true
        && (rule.value === '' || c.getAttribute('data-rule') === rule.value)
        && (layer.value === '' || has(c.getAttribute('data-layers'), layer.value))
        && (file.value === '' || has(c.getAttribute('data-files'), file.value))
        && (edge === '' || has(c.getAttribute('data-edges'), edge));
      c.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = 'Showing ' + shown + ' of ' + cards.length + ' finding' + (cards.length === 1 ? '' : 's');
    empty.hidden = shown !== 0;
    if (edge === '') { edgeNote.hidden = true; edgeNote.textContent = ''; }
    else { edgeNote.hidden = false; edgeNote.textContent = 'on the dependency ' + edge.replace('>', ' \\u2192 '); }
    layerBoxes.forEach(function (g) { g.classList.toggle('selected', layer.value !== '' && g.getAttribute('data-layer') === layer.value); });
    edgeGroups.forEach(function (g) { g.classList.toggle('selected', edge !== '' && g.getAttribute('data-edge') === edge); });
  }

  function hasOption(select, value) {
    return Array.prototype.some.call(select.options, function (o) { return o.value === value; });
  }
  function pickLayer(name) {
    if (!hasOption(layer, name)) return;
    edge = '';
    layer.value = layer.value === name ? '' : name;
    apply();
    byId('findings-h').scrollIntoView({ block: 'start' });
  }
  function pickEdge(value) {
    edge = edge === value ? '' : value;
    layer.value = '';
    apply();
    byId('findings-h').scrollIntoView({ block: 'start' });
  }
  function activate(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }

  [rule, layer, file].forEach(function (s) { s.addEventListener('change', function () { if (s === layer) edge = ''; apply(); }); });
  tierBoxes.forEach(function (b) { b.addEventListener('change', apply); });
  layerBoxes.forEach(function (g) { activate(g, function () { pickLayer(g.getAttribute('data-layer')); }); });
  edgeGroups.forEach(function (g) { activate(g, function () { pickEdge(g.getAttribute('data-edge')); }); });
  clear.addEventListener('click', function () {
    tierBoxes.forEach(function (b) { b.checked = true; });
    rule.value = ''; layer.value = ''; file.value = ''; edge = '';
    apply();
  });
  apply();
})();
`;
