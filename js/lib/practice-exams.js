/* Regex parser shared by the browser and regression checks. */
function parsePracticeExam(text) {
  const source = String(text || '').replace(/\r/g, '');
  const title = source.match(/^\s*(?:\*\*)?EXAM_TITLE\s*:\s*(?:\*\*)?(.+)$/im)?.[1].trim().replace(/\*\*$/, '') || 'Practice exam';
  const questions = [];
  const errors = [];
  const blocks = [...source.matchAll(/^\s*BEGIN_QUESTION(?:\s+(\d+))?\s*\n([\s\S]*?)^\s*END_QUESTION\s*$/gmi)];
  const started = (source.match(/^\s*BEGIN_QUESTION(?:\s+\d+)?\s*$/gmi) || []).length;
  if (started !== blocks.length) errors.push('A question is missing END_QUESTION. Copy the complete response.');
  if (!blocks.length) errors.push('No question blocks found. Use the prompt from Get prompt and paste its full response, including BEGIN_QUESTION and END_QUESTION.');
  for (const [index, block] of blocks.entries()) {
    const before = errors.length;
    const fields = {};
    let current = '';
    const problem = message => errors.push(`Question ${block[1] || index + 1}: ${message}`);
    for (const line of block[2].split('\n')) {
      const label = line.match(/^(?:\*\*)?(TYPE|TOPIC|SOURCE|PROMPT|ANSWER|EXPLANATION)\s*:\s*(?:\*\*)?\s*(.*)$/i)
        || line.match(/^([A-D])[).:]\s+(.*)$/i);
      if (label) {
        current = label[1].toUpperCase();
        if (fields[current] !== undefined) problem(`duplicate ${current} field.`);
        fields[current] = label[2];
      } else if (current) fields[current] += '\n' + line;
    }
    for (const key of Object.keys(fields)) fields[key] = fields[key].trim();
    const type = ({ TF: 'TRUE_FALSE', SHORT_ANSWER: 'SHORT' })[fields.TYPE?.toUpperCase()] || fields.TYPE?.toUpperCase();
    let answer = fields.ANSWER || '';
    const options = type === 'MCQ' ? ['A','B','C','D'].map(letter => ({ letter, text: fields[letter] || '' })) : [];
    if (!['MCQ','TRUE_FALSE','SHORT'].includes(type)) problem('TYPE must be MCQ, TRUE_FALSE or SHORT.');
    if (!fields.PROMPT) problem('missing PROMPT.');
    if (!answer) problem('missing ANSWER.');
    if (!fields.EXPLANATION) problem('missing EXPLANATION.');
    if (type === 'MCQ') {
      if (options.some(option => !option.text)) problem('MCQ requires four nonempty choices, A through D.');
      const letter = answer.match(/^([A-D])(?:[).:]\s*.*)?$/i)?.[1];
      if (!letter) problem('MCQ ANSWER must be A, B, C or D.');
      answer = letter?.toUpperCase() || answer;
    }
    if (type === 'TRUE_FALSE') {
      if (!/^(true|false)\.?$/i.test(answer)) problem('TRUE_FALSE ANSWER must be True or False.');
      answer = answer.toLowerCase().replace(/\.$/, '') === 'true' ? 'True' : 'False';
    }
    if (errors.length === before) questions.push({ type, topic:fields.TOPIC || '', source:fields.SOURCE || '', prompt:fields.PROMPT, options, answer, explanation:fields.EXPLANATION });
  }
  if (questions.length > 50) errors.push('Limit each imported test to 50 questions.');
  return { title, questions, errors };
}

function practiceExamScore(exam) {
  let correct = 0, graded = 0, pending = 0;
  for (const q of exam.questions) {
    if (q.type === 'SHORT') {
      const grade = exam.selfGrades?.[q.id];
      if (grade === 0 || grade === 1) { graded++; correct += grade; } else pending++;
    } else {
      graded++;
      if (exam.answers?.[q.id] === q.answer) correct++;
    }
  }
  return { correct, graded, pending, total:exam.questions.length, percent:graded ? Math.round(correct / graded * 100) : null };
}

if (typeof module !== 'undefined') module.exports = { parsePracticeExam, practiceExamScore };
