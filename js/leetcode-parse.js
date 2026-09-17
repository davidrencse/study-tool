/* ==========================================================================
   leetcode-parse.js — turns an Obsidian LeetCode note into a problem record.
   No browser APIs: tools/sync-leetcode.js loads this same file in Node.

   Expected vault layout (frontmatter optional):
     4 - Main Notes/Leetcode/<Easy|Medium|Hard>/<number>. <Title>.md
   ========================================================================== */

var LC_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/** NeetCode roadmap order. */
var LC_PATTERN_LIST = [
  'Arrays & Hashing', 'Two Pointers', 'Sliding Window', 'Stack', 'Binary Search', 'Linked List',
  'Trees', 'Tries', 'Heap / Priority Queue', 'Backtracking', 'Graphs', 'Advanced Graphs',
  '1-D DP', '2-D DP', 'Greedy', 'Intervals', 'Math & Geometry', 'Bit Manipulation', 'Strings', 'Other',
];

/** Problem number → pattern. Covers the NeetCode 150 plus the common extras. */
var LC_PATTERNS = (function () {
  var groups = {
    'Arrays & Hashing': '1 13 36 49 128 217 238 242 271 347 1464 169 14 26 27 88 118 205 290 303 448 560 1929',
    'Two Pointers': '11 15 42 125 167 977 283 344 392 680 844',
    'Sliding Window': '3 76 121 239 424 567 219 643 1004',
    'Stack': '20 22 84 150 155 739 853 232 225 71 402 901',
    'Binary Search': '4 33 34 35 74 153 704 875 981 69 278 374 540',
    'Linked List': '2 19 21 23 25 61 86 138 141 142 143 146 206 287 83 92 160 203 234 876',
    'Trees': '94 98 100 101 102 104 105 110 124 144 145 199 226 230 235 297 543 572 1448 108 111 112 113 114 116 257 404 437 617 662',
    'Tries': '208 211 212 14',
    'Heap / Priority Queue': '215 295 355 621 703 973 1046 767 1642',
    'Backtracking': '17 39 40 46 47 51 77 78 79 90 131 22 216 1863',
    'Graphs': '130 133 200 207 210 261 286 323 417 684 695 994 127 547 733 1971',
    'Advanced Graphs': '269 332 743 778 787 1584 1631',
    '1-D DP': '5 70 91 139 152 198 213 300 322 416 647 746 55 509 1137',
    '2-D DP': '10 62 72 97 115 309 312 329 494 518 1143 63 64 221',
    'Greedy': '45 53 134 678 763 846 1899 122 605 1005',
    'Intervals': '56 57 252 253 435 1851 986',
    'Math & Geometry': '9 43 48 50 54 66 73 202 2013 12 7 67 172 263',
    'Bit Manipulation': '29 136 190 191 268 338 371 7 231 461',
  };
  var map = {};
  for (var g in groups) groups[g].split(' ').forEach(function (n) { if (!map[n]) map[n] = g; });
  // specific overrides where a problem sits in several lists above
  map['55'] = 'Greedy';
  map['14'] = 'Strings';
  map['28'] = 'Strings';
  map['58'] = 'Strings';
  map['13'] = 'Strings';
  map['7'] = 'Math & Geometry';
  map['22'] = 'Backtracking';
  return map;
})();

function lcSlug(title) {
  return title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function lcGuessPattern(num, title, code) {
  if (LC_PATTERNS[num]) return LC_PATTERNS[num];
  var t = (title + '\n' + code).toLowerCase();
  if (/treenode|\btree\b/.test(t)) return 'Trees';
  if (/listnode|linked list/.test(t)) return 'Linked List';
  if (/\bdp\s*=|\bdp\[|memo|lru_cache|@cache/.test(t)) return '1-D DP';
  if (/heapq|heappush/.test(t)) return 'Heap / Priority Queue';
  if (/deque|window/.test(t)) return 'Sliding Window';
  if (/\bstack\b/.test(t)) return 'Stack';
  if (/\bmid\b|binary search/.test(t)) return 'Binary Search';
  if (/backtrack|permut|combination|subset/.test(t)) return 'Backtracking';
  if (/interval/.test(t)) return 'Intervals';
  if (/\bgrid\b|graph|island/.test(t)) return 'Graphs';
  return 'Other';
}

/**
 * Obsidian often pastes code from LeetCode with a blank line after every line.
 * When most lines are separated that way, drop single blanks and keep real
 * paragraph breaks (two or more blanks) as one.
 */
function lcTidyCode(code) {
  // non-breaking spaces from the paste would also be a syntax error in Python
  var lines = code.replace(/ /g, ' ').replace(/\t/g, '    ').split('\n').map(function (l) { return l.replace(/\s+$/, ''); });
  var blank = lines.filter(function (l) { return !l; }).length;
  var filled = lines.length - blank;
  if (filled && blank >= filled * 0.4) {
    var out = [];
    var run = 0;
    lines.forEach(function (l) {
      if (!l) { run++; return; }
      if (run >= 2 && out.length) out.push('');
      run = 0;
      out.push(l);
    });
    lines = out;
  }
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();

  // a snippet copied from inside a method: first line flush left, the rest indented
  var indent = function (l) { return l.match(/^ */)[0].length; };
  var rest = lines.slice(1).filter(Boolean);
  if (lines.length > 1 && indent(lines[0]) === 0 && !/^(class|def|from|import|@|#)/.test(lines[0]) && rest.length) {
    var cut = Math.min.apply(null, rest.map(indent));
    if (cut > 0) lines = lines.map(function (l, i) { return i ? l.slice(cut) : l; });
  }

  // `class Solution:` / `def f():` whose body lost its indent: push what follows in by one level
  for (var i = 0; i < lines.length; i++) {
    if (!/^\s*(class|def)\s[^#]*:\s*(#.*)?$/.test(lines[i])) continue;
    var j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && indent(lines[j]) <= indent(lines[i])) {
      for (var k = i + 1; k < lines.length; k++) if (lines[k]) lines[k] = '    ' + lines[k];
    }
  }
  return lines.join('\n');
}

/**
 * @param {{path: string, text: string, date: string}} file
 *   path: vault-relative, forward slashes. date: YYYY-MM-DD the note was created.
 * @returns problem record, or null if the file isn't a LeetCode note
 */
function parseLeetcodeNote(file) {
  var parts = file.path.split('/');
  var name = parts[parts.length - 1];
  var m = name.match(/^(\d+)\s*[.)-]\s*(.+?)\.md$/i);
  if (!m) return null;
  var num = +m[1];
  var title = m[2].trim();

  var text = (file.text || '').replace(/\r/g, '');
  var front = {};
  var fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    fm[1].split('\n').forEach(function (l) {
      var kv = l.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kv) front[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
    });
    text = text.slice(fm[0].length);
  }

  var folderDiff = parts.slice(0, -1).map(function (p) { return p.toLowerCase(); });
  var difficulty = LC_DIFFICULTIES.find(function (d) { return folderDiff.includes(d.toLowerCase()); })
    || LC_DIFFICULTIES.find(function (d) { return (front.difficulty || '').toLowerCase() === d.toLowerCase(); })
    || 'Medium';

  // pull out fenced code; the first block is the solution
  var blocks = [];
  var prose = text.replace(/```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g, function (_, lang, body) {
    blocks.push({ lang: (lang || 'python').toLowerCase(), code: lcTidyCode(body) });
    return '\n@@CODE' + (blocks.length - 1) + '@@\n';
  });

  var urlMatch = prose.match(/https?:\/\/(?:www\.)?leetcode\.com\/problems\/[^\s)>\]]+/);
  var url = front.url || front.link || (urlMatch ? urlMatch[0] : 'https://leetcode.com/problems/' + lcSlug(title) + '/');
  url = url.replace(/(\/problems\/[^/]+\/).*$/, '$1');

  var main = blocks[0] || { lang: 'python', code: '' };
  var notes = prose
    .replace(/https?:\/\/(?:www\.)?leetcode\.com\/problems\/\S*/g, '')
    .replace(/@@CODE0@@/, '')
    .replace(/@@CODE(\d+)@@/g, function (_, i) { return '```' + blocks[i].lang + '\n' + blocks[i].code + '\n```'; })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  var tags = [];
  (front.tags || '').replace(/[\[\]]/g, '').split(/[,\s]+/).forEach(function (t) { if (t) tags.push(t.replace(/^#/, '')); });
  (notes.match(/(^|\s)#([A-Za-z][\w/-]*)/g) || []).forEach(function (t) { tags.push(t.trim().slice(1)); });

  return {
    id: 'lc-' + num,
    num: num,
    title: title,
    difficulty: difficulty,
    pattern: front.pattern || lcGuessPattern(String(num), title, main.code),
    url: url,
    lang: main.lang,
    code: main.code,
    notes: notes,
    tags: tags.filter(function (t, i) { return tags.indexOf(t) === i && !/^leetcode$/i.test(t); }),
    solved: front.date || front.solved || file.date,
    path: file.path,
  };
}

if (typeof module !== 'undefined') module.exports = { parseLeetcodeNote: parseLeetcodeNote };
