/* ==========================================================================
   ai.js — ChatGPT prompt templates + in-app summarizer (offline & API)
   ========================================================================== */

/* ---------------- Prompt templates (sent to ChatGPT in the browser) ---------------- */
const PROMPT_TEMPLATES = [
  {
    id: 'explain',
    name: 'Explain it simply',
    desc: 'Plain-language explanation with an analogy and example.',
    build: (c) => `I'm a college student taking ${c.cls}. Explain ${c.topic || 'the following concept'} to me as if I'm seeing it for the first time.

1. Start with a one-sentence plain-English definition.
2. Give a real-world analogy.
3. Walk through a concrete example step by step.
4. List the 3 most common misconceptions.
5. End with 3 quick check-for-understanding questions (answers hidden at the bottom).${c.extra ? `\n\nSpecifically: ${c.extra}` : ''}${c.note ? `\n\nHere are my notes for context:\n"""\n${c.note}\n"""` : ''}`,
  },
  {
    id: 'tutor',
    name: 'Socratic tutor',
    desc: 'It asks you questions one at a time instead of lecturing.',
    build: (c) => `Act as a Socratic tutor for my ${c.cls} class. The topic is ${c.topic || 'whatever I bring up'}.

Rules:
- Ask me ONE question at a time and wait for my answer.
- Don't give the answer outright; give hints if I'm stuck.
- Gradually increase the difficulty.
- After every 5 questions, summarize what I've shown I understand and what I still need to work on.${c.extra ? `\n\nFocus on: ${c.extra}` : ''}${c.note ? `\n\nBase your questions on my notes:\n"""\n${c.note}\n"""` : ''}

Start with your first question.`,
  },
  {
    id: 'exam',
    name: 'Practice exam',
    desc: 'Mixed-format questions with an answer key at the end.',
    build: (c) => `Write a practice exam for ${c.cls}${c.topic ? ` covering ${c.topic}` : ''}.

Include:
- 5 multiple-choice questions
- 3 short-answer questions
- 1 longer problem or essay question${c.cls.match(/operating|security/i) ? ' (include a worked/technical problem)' : ''}

Match the difficulty of an upper-level undergraduate course. Put the full answer key with explanations at the very end, under a heading "ANSWER KEY".${c.extra ? `\n\nExtra instructions: ${c.extra}` : ''}${c.note ? `\n\nUse these notes as the source material:\n"""\n${c.note}\n"""` : ''}`,
  },
  {
    id: 'summarize',
    name: 'Summarize my notes',
    desc: 'Condensed study guide from your own notes.',
    build: (c) => `Turn my ${c.cls} notes${c.topic ? ` on ${c.topic}` : ''} into a concise study guide:
- A 3-sentence overview
- Key terms with one-line definitions
- The main ideas as bullet points
- Anything that seems missing or unclear in my notes${c.extra ? `\n\n${c.extra}` : ''}

My notes:
"""
${c.note || '(paste your notes here)'}
"""`,
  },
  {
    id: 'gaps',
    name: 'Find gaps in my notes',
    desc: 'Spot what’s missing, wrong, or shallow.',
    build: (c) => `Review my ${c.cls} notes${c.topic ? ` on ${c.topic}` : ''} like a strict TA. Point out:
1. Anything factually wrong
2. Important concepts that are missing
3. Places where my explanation is too shallow
4. Suggested additions, written so I can paste them straight into my notes${c.extra ? `\n\n${c.extra}` : ''}

Notes:
"""
${c.note || '(paste your notes here)'}
"""`,
  },
  {
    id: 'compare',
    name: 'Compare & contrast',
    desc: 'Side-by-side table for concepts people mix up.',
    build: (c) => `For ${c.cls}, make a compare-and-contrast table of ${c.extra || `the key concepts within ${c.topic || 'this course'}`}. Columns: concept, definition, when it's used, pros/strengths, cons/limitations, a classic example. Then add a short "How to tell them apart on an exam" section.`,
  },
  {
    id: 'connect',
    name: 'Cross-class connections',
    desc: 'Link this topic to your other classes.',
    build: (c) => `I'm taking these classes at the same time: ${S().classes.map((x) => x.name).join(', ')}.

Show me meaningful connections between ${c.topic || c.cls} and my other classes. For each connection: name both concepts, explain the link in 2–3 sentences, and suggest one question that would help me think across both classes.${c.extra ? `\n\n${c.extra}` : ''}`,
  },
  {
    id: 'plan',
    name: 'Study plan',
    desc: 'Day-by-day plan based on your deadlines.',
    build: (c) => {
      const upcoming = deadlines()
        .filter((e) => !e.done && e.date >= todayStr())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 12)
        .map((e) => `- ${e.date}: ${className(e.classId)} — ${e.title} (${EVENT_TYPES[e.type]?.label || e.type})`)
        .join('\n');
      return `Build me a realistic day-by-day study plan for the next 2 weeks. Today is ${todayStr()}.

My classes: ${S().classes.map((x) => x.name).join(', ')}.
Upcoming deadlines:
${upcoming || '(none entered yet)'}

Use short focused sessions (25–50 min), spaced repetition, and put the hardest work earlier in the day. ${c.extra ? `Constraints: ${c.extra}` : 'Assume about 3 hours of study time per weekday and 4 per weekend day.'}`;
    },
  },
  {
    id: 'essay',
    name: 'Paper / essay helper',
    desc: 'Thesis, outline, and sources to look for (great for the seminar).',
    build: (c) => `I'm writing a paper for ${c.cls}${c.topic ? ` about ${c.topic}` : ''}. ${c.extra ? `My working idea: ${c.extra}.` : ''}

Help me:
1. Sharpen 3 possible thesis statements (arguable, specific)
2. Build an outline for the strongest one with section-by-section claims
3. Name key scholars, theories, and types of evidence I should look for (don't invent citations — tell me what to search for)
4. List likely counterarguments and how to address them

Don't write the paper for me — I want to write it myself.${c.note ? `\n\nMy notes so far:\n"""\n${c.note}\n"""` : ''}`,
  },
  {
    id: 'flashcards',
    name: 'Make flashcards',
    desc: 'Anki-style cards in a format this app can import.',
    build: (c) => buildCardPrompt({ cls: c.cls, topic: c.topic, count: 15, style: 'mixed', source: c.note, extra: c.extra }),
  },
];

function buildCardPrompt({ cls, topic, count = 15, style = 'basic', source = '', extra = '' }) {
  const styleText = {
    basic: 'Use straightforward question → answer cards.',
    cloze: 'Make fill-in-the-blank cards: the Q line is a sentence with the key term replaced by "_____", and the A line is the missing term.',
    mixed: 'Mix definition cards, "why/how" cards, compare/contrast cards, and a few applied scenario cards.',
    deep: 'Focus on understanding over memorization: "why", "what happens if", and "how does X relate to Y" questions.',
  }[style];
  return `Create ${count} high-quality Anki-style flashcards for my ${cls} class${topic ? ` on the topic "${topic}"` : ''}.

Rules for good cards:
- One idea per card (atomic)
- Short, precise answers (ideally under 25 words)
- No "list everything" cards; split them up
- ${styleText}${extra ? `\n- ${extra}` : ''}

OUTPUT FORMAT — follow EXACTLY, no extra commentary, no numbering, no markdown:
Q: question text
A: answer text

Q: question text
A: answer text${source ? `\n\nBase the cards on this material:\n"""\n${source}\n"""` : ''}`;
}

/* ---------------- Built-in extractive summarizer (runs offline) ---------------- */
const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren as at be because been before being below between both but by can cannot could did do does doing don down during each etc few for from further get gets got had has have having he her here hers herself him himself his how however i if in into is isn it its itself just let like may me might more most much must my myself no nor not now of off on once only or other ought our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through thus to too under until up upon us use used uses using very via was we well were what when where which while who whom why will with within without would yes yet you your yours yourself yourselves one two also e.g i.e vs etc way many often called give gives given make makes made happen happens occur occurs decide decides divide divides spend spends take takes time full large small new good best first second next each every include includes including based argue argues argued suggest suggests instead`.split(/\s+/)
);

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(sses)$/, 'ss').replace(/([^s])s$/, '$1');
const words = (s) => (s.toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g) || []).filter((w) => !STOPWORDS.has(w) && w.length > 2);

function splitSentences(text) {
  const out = [];
  const headings = [];
  for (const rawLine of (text || '').replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) {
      headings.push(stripMarkdown(h[1]));
      continue;
    }
    const clean = stripMarkdown(line).trim();
    if (!clean) continue;
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      out.push(clean);
      continue;
    }
    clean
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
      .map((x) => x.trim())
      .filter((x) => x.length > 2)
      .forEach((x) => out.push(x));
  }
  return { sentences: out, headings };
}

function summarizeOffline(text, { sentences: n = 5 } = {}) {
  const { sentences, headings } = splitSentences(text);
  if (!sentences.length) return { summary: [], terms: [], cards: [] };

  // term frequencies
  const freq = new Map();
  const surface = new Map();
  for (const s of sentences)
    for (const w of words(s)) {
      const k = stem(w);
      freq.set(k, (freq.get(k) || 0) + 1);
      if (!surface.has(k)) surface.set(k, w);
    }
  const headingTerms = new Set(headings.flatMap((h) => words(h).map(stem)));
  const max = Math.max(1, ...freq.values());

  // bigram phrases (e.g. "virtual memory", "food security")
  const bigrams = new Map();
  for (const s of sentences) {
    const ws = s.toLowerCase().match(/[a-z][a-z0-9'-]+/g) || [];
    for (let i = 0; i < ws.length - 1; i++) {
      if (STOPWORDS.has(ws[i]) || STOPWORDS.has(ws[i + 1]) || ws[i].length < 3 || ws[i + 1].length < 3) continue;
      const k = ws[i] + ' ' + ws[i + 1];
      bigrams.set(k, (bigrams.get(k) || 0) + 1);
    }
  }

  const scored = sentences.map((s, i) => {
    const ws = words(s).map(stem);
    if (!ws.length) return { s, i, score: 0 };
    let score = ws.reduce((a, w) => a + freq.get(w) / max + (headingTerms.has(w) ? 0.5 : 0), 0) / Math.pow(ws.length, 0.6);
    if (i < 3) score *= 1.15;
    if (/\b(is|are|refers to|means|defined as)\b/i.test(s)) score *= 1.2;
    if (s.length < 25) score *= 0.6;
    if (s.length > 320) score *= 0.7;
    return { s, i, score };
  });

  const picked = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(n, sentences.length))
    .sort((a, b) => a.i - b.i);

  let phraseTerms = [...bigrams.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  // merge overlapping bigrams ("community land" + "land trusts" → "community land trusts")
  for (let i = 0; i < phraseTerms.length; i++)
    for (let j = 0; j < phraseTerms.length; j++) {
      const a = phraseTerms[i], b = phraseTerms[j];
      if (i !== j && a && b && a.split(' ').pop() === b.split(' ')[0] && text.toLowerCase().includes(`${a} ${b.split(' ').slice(1).join(' ')}`)) {
        phraseTerms[i] = `${a} ${b.split(' ').slice(1).join(' ')}`;
        phraseTerms[j] = '';
      }
    }
  phraseTerms = phraseTerms.filter(Boolean).slice(0, 6);
  const singleTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || surface.get(b[0]).length - surface.get(a[0]).length)
    .map(([k]) => surface.get(k))
    .filter((w) => !phraseTerms.some((p) => p.includes(w)))
    .slice(0, 12 - phraseTerms.length);
  const terms = [...phraseTerms, ...singleTerms];

  // flashcard suggestions: definitions first, then cloze deletions
  const cards = [];
  const seen = new Set();
  for (const s of sentences) {
    const m = s.match(/^(?:an?\s+|the\s+)?(.{3,50}?)\s+(?:is|are|refers to|means|is defined as)\s+(.{12,})$/i);
    const termOk = m && m[1].split(/\s+/).length <= 4 && !/^(this|it|that|there|they|he|she|we|you)$/i.test(m[1]) && !/\b(when|if|because|which|that|who|where|occurs?|happens?)\b/i.test(m[1]) && !/^(not|also|very|often|usually)\b/i.test(m[2]);
    if (termOk) {
      let term = m[1].replace(/^[-–—:\s]+/, '');
      if (/^[A-Z][a-z]/.test(term)) term = term[0].toLowerCase() + term.slice(1);
      if (seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      cards.push({ front: `What ${/\bare\b/i.test(s) && !/\bis\b/i.test(s) ? 'are' : 'is'} ${term}?`, back: m[2].replace(/\.$/, '') });
    }
    if (cards.length >= 6) break;
  }
  const usedTerms = new Set();
  for (const { s } of picked) {
    if (cards.length >= 10) break;
    const term = terms.find((t) => !usedTerms.has(t) && new RegExp(`\\b${reEsc(t)}\\b`, 'i').test(s));
    if (!term || seen.has('cloze:' + s)) continue;
    seen.add('cloze:' + s);
    usedTerms.add(term);
    const front = s.replace(new RegExp(`\\b${reEsc(term)}\\b`, 'i'), '_____');
    cards.push({ front, back: term });
  }

  const wordCount = (text.match(/\S+/g) || []).length;
  return {
    summary: picked.map((p) => p.s),
    terms,
    cards,
    stats: { words: wordCount, sentences: sentences.length, readMin: Math.max(1, Math.round(wordCount / 230)) },
  };
}

/* ---------------- Optional: real LLM summary via your own OpenAI API key ---------------- */
async function summarizeWithOpenAI(text, { sentences = 5, className: cls = '' } = {}) {
  const { openaiKey, openaiModel } = S().settings;
  if (!openaiKey) throw new Error('No API key set (Settings → AI).');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: openaiModel || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a study assistant. Reply ONLY with JSON: {"summary": string[], "terms": string[], "cards": [{"front": string, "back": string}]}. summary = key points as short bullet sentences; terms = up to 12 key terms; cards = up to 10 atomic Anki-style flashcards with short answers.',
        },
        { role: 'user', content: `Class: ${cls || 'general'}. Summarize into about ${sentences} bullet points.\n\n${text}` },
      ],
    }),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg += ' — ' + (await res.json()).error.message;
    } catch (_) {}
    throw new Error(`API error ${msg}`);
  }
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  const wordCount = (text.match(/\S+/g) || []).length;
  return {
    summary: parsed.summary || [],
    terms: parsed.terms || [],
    cards: (parsed.cards || []).filter((c) => c.front && c.back),
    stats: { words: wordCount, sentences: splitSentences(text).sentences.length, readMin: Math.max(1, Math.round(wordCount / 230)) },
  };
}

/** Rough answer similarity for the active-recall screen (token overlap, 0–100). */
function answerSimilarity(given, expected) {
  const a = new Set(words(given).map(stem));
  const b = new Set(words(expected).map(stem));
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const w of b) if (a.has(w)) hit++;
  return Math.round((hit / b.size) * 100);
}
