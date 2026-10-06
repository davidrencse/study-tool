/* Curated reference notes and short-answer recall cards for every class topic. */
CONTENT_PACKS.push({
  id: 'nyu-fall-2026-subtopic-guides-v2',
  apply(s) {
    const topics = new Map(s.topics.map(t => [t.id, t]));
    const cardKeys = new Set(s.cards.map(c => c.guideKey).filter(Boolean));
    const today = todayStr();
    const dayFor = key => {
      let hash = 2166136261;
      for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      return addDays(today, (hash >>> 0) % 14);
    };
    for (const guide of STUDY_GUIDE_DATA) {
      const topic = topics.get(guide.topicId);
      if (!topic) throw new Error(`Missing study guide topic: ${guide.topicId}`);
      const course = s.classes.find(c => c.id === topic.classId);
      for (const [index, section] of guide.sections.entries()) {
        const key = `study-guide-${topic.id}-${index + 1}`;
        const title = `${topic.name}: ${section.title}`;
        const qa = section.cards.map(([question, answer]) => `- **${question}** ${answer}`).join('\n');
        const body = `# ${section.title}\n\n**Topic:** ${topic.name}\n\n## Understand it\n\n${section.learn}\n\n## Example or application\n\n${section.example}\n\n## Check your recall\n\n${qa}${course?.info?.lms ? `\n\n[Open ${course.name} on Brightspace](${course.info.lms})` : ''}`;
        const existing = s.notes.find(n => n.id === key);
        if (!existing) s.notes.push({ id: key, title, body, classId: topic.classId, topicId: topic.id,
          tags: ['study-guide', topic.name], created: Date.now(), updated: Date.now() });
        else if (existing.updated === existing.created && existing.body !== body) {
          existing.body = body;
          existing.created = existing.updated = Date.now();
        }
        for (const [cardIndex, [question, answer]] of section.cards.entries()) {
          const guideKey = `${key}-card-${cardIndex + 1}`;
          if (cardKeys.has(guideKey)) continue;
          s.cards.push({ ...newCard({ front: `${topic.name} · ${question}`, back: answer,
            classId: topic.classId, topicId: topic.id, source: 'study-guide' }), guideKey, due: dayFor(guideKey) });
          cardKeys.add(guideKey);
        }
      }
    }
  },
});
