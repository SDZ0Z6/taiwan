/* Hand-drawn doodles, each drawn in a 48 x 48 box centred on 0,0.
   Stroke classes: s-b blue ink, s-r red, s-y yellow, s-o orange, s-g green.
   Fill classes: f-w white, f-p peach, f-r red, f-rl light red, f-y light yellow,
   f-o orange, f-i ink, f-bl light blue, f-g green. */
window.ICONS = {
  sparkle: '<path class="s-y f-y" d="M0-14C1.5-5 5-1.5 14 0C5 1.5 1.5 5 0 14C-1.5 5-5 1.5-14 0C-5-1.5-1.5-5 0-14Z"/>',
  heart: '<path class="s-r" d="M0 11C-9 4-13-1-11-6C-9-11-3-11 0-5C3-11 9-11 11-6C13-1 9 4 0 11Z"/>',
  heartFill: '<path class="s-r f-r" d="M0 11C-9 4-13-1-11-6C-9-11-3-11 0-5C3-11 9-11 11-6C13-1 9 4 0 11Z"/>',
  dotB: '<circle class="f-b" r="4"/>',
  dotG: '<circle class="f-g" r="4"/>',
  squiggle: '<path class="s-b w3" d="M-16 4C-12-6-8 10-3 0C2-10 6 8 11-2C13-6 15-4 16-2"/>',
  dashes: '<path class="s-b w3" d="M-8-8L2-14M-6 2L10-6"/>',

  skylantern:
    '<path class="s-b f-p" d="M-11-14L11-14L7 9L-7 9Z"/>' +
    '<path class="s-b" d="M-11-14C-5-11 5-11 11-14M-10-5L10-5M-7 9C-4 11 4 11 7 9"/>' +
    '<path class="s-r" d="M-3-10L3-10M0-12L0-7"/>' +
    '<path class="s-o f-o" d="M0 12C-3 15-1.5 19 0 19C1.5 19 3 15 0 12Z"/>',

  lantern:
    '<ellipse class="s-r f-rl" cx="0" cy="1" rx="11" ry="11"/>' +
    '<path class="s-r" d="M0-10V12M-6-8C-10-2-10 4-6 10M6-8C10-2 10 4 6 10"/>' +
    '<path class="s-r f-r" d="M-6-13H6L5-10H-5Z M-6 15H6L5 12H-5Z"/>' +
    '<path class="s-b" d="M0-13V-19M0 15V21M-2.5 21H2.5"/>',

  tower101:
    '<path class="s-b f-w" d="M-6 18L6 18L5 9L-5 9Z M-6 9L6 9L5 1L-5 1Z M-6 1L6 1L5-7L-5-7Z M-6-7L6-7L5-14L-5-14Z"/>' +
    '<path class="s-b f-bl" d="M-3-14L3-14L2-18L-2-18Z"/>' +
    '<path class="s-b" d="M0-18V-24M-11 18H11"/>',

  train:
    '<path class="s-b f-w" d="M-18 6H8C15 6 19 2 19 0C15-5 7-7-18-7Z"/>' +
    '<path class="s-o w3" d="M-18 1H15"/>' +
    '<path class="s-b" d="M-13-3H-8M-5-3H0M3-3H8"/>' +
    '<circle class="s-b f-w" cx="-11" cy="7" r="2.2"/><circle class="s-b f-w" cx="3" cy="7" r="2.2"/>',

  plane:
    '<path class="s-b f-w" d="M17 0C17-1.6 15-2.4 12-2.4H4L-4-13H-8L-4-2.4H-11L-14-7H-17L-15 0L-17 7H-14L-11 2.4H-4L-8 13H-4L4 2.4H12C15 2.4 17 1.6 17 0Z"/>',

  temple:
    '<path class="s-r f-rl" d="M-19-1C-13-2-8-6-4-11L4-11C8-6 13-2 19-1C14 1-14 1-19-1Z"/>' +
    '<path class="s-r" d="M-6-11C-6-14-3-15-2-12M6-11C6-14 3-15 2-12"/>' +
    '<path class="s-b" d="M-13 0V15M13 0V15M-17 15H17"/>' +
    '<path class="s-b f-p" d="M-4 15V6H4V15"/>',

  bowl:
    '<path class="s-b f-w" d="M-15 1H15C15 10 8 15 0 15C-8 15-15 10-15 1Z"/>' +
    '<path class="s-y" d="M-10 1C-7-2-4 2-1-1C2-4 5 0 8-2"/>' +
    '<path class="s-b" d="M-6-5C-9-9-3-11-6-16M1-5C-2-9 4-11 1-16M5-3L17-16M8-2L19-13"/>',

  bubbletea:
    '<path class="s-b f-p" d="M-9-8H9L7 16H-7Z"/>' +
    '<path class="s-b f-w" d="M-10-8H10L9-11H-9Z"/>' +
    '<path class="s-r w3" d="M2-11L6-21"/>' +
    '<circle class="f-i" cx="-3" cy="12" r="1.8"/><circle class="f-i" cx="1" cy="13" r="1.8"/><circle class="f-i" cx="4" cy="10" r="1.8"/><circle class="f-i" cx="-1" cy="9" r="1.8"/>',

  hotspring:
    '<path class="s-b f-bl" d="M-14 4C-14 14 14 14 14 4Z"/>' +
    '<path class="s-r" d="M-7 0C-10-4-4-7-7-12M0 0C-3-4 3-7 0-12M7 0C4-4 10-7 7-12"/>',

  sunset:
    '<path class="s-y f-y" d="M-9 4A9 9 0 0 1 9 4Z"/>' +
    '<path class="s-y" d="M0-9V-14M-9-6L-12-10M9-6L12-10"/>' +
    '<path class="s-b" d="M-17 4H17M-12 9H12M-7 14H7"/>',

  house:
    '<path class="s-b f-w" d="M-9 1L0-8L9 1V10H-9Z"/>' +
    '<path class="s-b" d="M-11 2L0-10L11 2"/>' +
    '<path class="s-b f-p" d="M-2.5 10V4H2.5V10"/>',

  wave: '<path class="s-b o5" d="M-14 0C-11-3-8-3-5 0C-2 3 1 3 4 0C7-3 10-3 13 0"/>',

  mountain:
    '<path class="s-b f-w" d="M-14 9L-5-6L0 1L5-9L14 9Z"/>' +
    '<path class="s-b" d="M2-4.5L5-2.5L8-4.5"/>',

  cake:
    '<path class="s-b f-p" d="M-12 2H12V14H-12Z"/>' +
    '<path class="s-r" d="M-12 7C-8 10-4 4 0 7C4 10 8 4 12 7"/>' +
    '<path class="s-b" d="M-5 2V-5M5 2V-5"/>' +
    '<path class="f-o" d="M-5-6C-7-9-5-12-5-12C-5-12-3-9-5-6ZM5-6C3-9 5-12 5-12C5-12 7-9 5-6Z"/>',

  cocktail:
    '<path class="s-b f-bl" d="M-12-10H12L0 3Z"/>' +
    '<path class="s-b" d="M0 3V15M-7 15H7M6-13L12-19"/>' +
    '<circle class="s-r f-rl" cx="5" cy="-6" r="2.5"/>',

  boat:
    '<path class="s-b f-p" d="M-16 2H16L11 9H-11Z"/>' +
    '<path class="s-b" d="M-4 2V-14M-4-14L8-4H-4"/>' +
    '<path class="s-b o5" d="M-18 14C-15 12-12 12-9 14C-6 16-3 16 0 14C3 12 6 12 9 14C12 16 15 16 18 14"/>'
};

/* Returns an <svg> string for HTML use. */
window.iconSVG = function (name, size, cls) {
  var s = size || 40;
  return '<svg class="doodle ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="-24 -24 48 48" aria-hidden="true"><g class="ico">' + (window.ICONS[name] || '') + '</g></svg>';
};
