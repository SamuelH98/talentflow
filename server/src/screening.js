// Reusable screening questions: a company-level question library that recruiters
// attach to individual jobs (mirroring Greenhouse / Lever / iCIMS conventions).
//
// - library:  screening_questions (company-scoped, with per-question defaults)
// - per job:  job_screening_questions (enable/disable, required, order per job)
// - effective: a job uses its own config when it exists, otherwise inherits the
//   library defaults — so new jobs automatically show the company defaults until
//   a recruiter customizes them.

export const QUESTION_TYPES = {
  text: 'Short answer',
  paragraph: 'Paragraph / long answer',
  single: 'Single choice',
  multiple: 'Multiple choice',
};

export const MAX_LABEL_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_OPTIONS = 12;
export const MAX_ANSWER_LENGTH = 2000;
export const MAX_OPTION_LENGTH = 200;

export function questionPublic(q) {
  return {
    id: q.id,
    label: q.label,
    description: q.description,
    type: q.type,
    options: q.options || [],
    required: !!q.required,
  };
}

export function getLibrary(db, companyId) {
  return db
    .prepare(
      `SELECT * FROM screening_questions
       WHERE company_id = ?
       ORDER BY position ASC, id ASC`
    )
    .all(companyId)
    .map((q) => ({ ...q, options: safeJson(q.options) || [] }));
}

function safeJson(value) {
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch { return null; }
}

export function jobConfig(db, companyId, jobId) {
  const rows = db
    .prepare(
      `SELECT jsq.enabled, jsq.required, jsq.position, sq.id, sq.label, sq.description, sq.type, sq.options
       FROM job_screening_questions jsq
       JOIN screening_questions sq ON sq.id = jsq.question_id
       WHERE jsq.job_id = ? AND sq.company_id = ?
       ORDER BY jsq.position ASC, jsq.id ASC`
    )
    .all(jobId, companyId);
  if (rows.length === 0) {
    return {
      inherited: true,
      questions: getLibrary(db, companyId).map((q, i) => ({
        id: q.id,
        label: q.label,
        description: q.description,
        type: q.type,
        options: q.options,
        required: !!q.default_required,
        enabled: !!q.default_enabled,
        position: i,
      })),
    };
  }
  return {
    inherited: false,
    questions: rows.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      type: r.type,
      options: safeJson(r.options) || [],
      required: !!r.required,
      enabled: !!r.enabled,
      position: r.position,
    })),
  };
}

export function effectiveQuestions(db, companyId, jobId) {
  const cfg = jobConfig(db, companyId, jobId);
  if (!cfg.inherited) {
    return cfg.questions.filter((q) => q.enabled).map((q) => questionPublic(q));
  }
  return getLibrary(db, companyId)
    .filter((q) => q.default_enabled)
    .map((q) => ({
      id: q.id,
      label: q.label,
      description: q.description,
      type: q.type,
      options: q.options,
      required: !!q.default_required,
    }));
}

export function sanitizeScreeningAnswers(questions, raw) {
  const errors = {};
  const answers = {};
  if (!raw || typeof raw !== 'object') raw = {};
  for (const q of questions) {
    const v = raw[String(q.id)];
    if (q.type === 'multiple') {
      const picked = Array.isArray(v)
        ? v.filter((x) => typeof x === 'string' && q.options.some((o) => o.value === x)).slice(0, MAX_OPTIONS)
        : [];
      const set = new Set(picked);
      answers[String(q.id)] = [...set];
      if (q.required && answers[String(q.id)].length === 0) errors[String(q.id)] = q.label;
    } else if (q.type === 'single') {
      const value = typeof v === 'string' && q.options.some((o) => o.value === v) ? v : null;
      if (value != null) answers[String(q.id)] = value;
      else if (q.required) errors[String(q.id)] = q.label;
    } else {
      const value = typeof v === 'string' ? v.trim().slice(0, MAX_ANSWER_LENGTH) : '';
      if (value) answers[String(q.id)] = value;
      else if (q.required) errors[String(q.id)] = q.label;
    }
  }
  return { answers, errors };
}

export function screeningAnswersForApplication(db, app) {
  const row = db.prepare('SELECT data FROM application_answers WHERE application_id = ?').get(app.id);
  if (!row) return [];
  const data = safeJson(row.data) || {};
  const screening = (data && data.screening) || {};
  const questions = effectiveQuestions(db, app.company_id, app.job_id);
  const byId = new Map(questions.map((q) => [String(q.id), q]));
  const out = [];
  for (const [qid, answer] of Object.entries(screening)) {
    const q = byId.get(qid);
    if (q) {
      out.push({
        question: q.label,
        type: q.type,
        options: q.options,
        answer: Array.isArray(answer)
          ? answer.map((v) => optionLabel(q.options, v)).join(', ')
          : q.type === 'single'
            ? optionLabel(q.options, answer)
            : answer,
      });
    } else {
      out.push({ question: `Question #${qid}`, type: 'text', options: [], answer });
    }
  }
  return out;
}

function optionLabel(options, value) {
  const o = (options || []).find((x) => x.value === value);
  return o ? o.label : value;
}

export function saveJobQuestionConfig(db, companyId, jobId, input) {
  if (!Array.isArray(input)) throw new ScreenQuestionValidation('questions must be an array');
  const ids = new Set(input.map((x) => x.question_id));
  for (const n of input) {
    if (!Number.isInteger(n.question_id)) throw new ScreenQuestionValidation('question_id must be an integer');
  }
  const known = db
    .prepare('SELECT id FROM screening_questions WHERE company_id = ? AND id IN (' + [...ids].map(() => '?').join(',') + ')')
    .all(companyId, ...[...ids]);
  if (known.length !== ids.size) throw new ScreenQuestionValidation('One or more questions do not belong to your company');
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM job_screening_questions WHERE job_id = ?').run(jobId);
    const insert = db.prepare(
      `INSERT INTO job_screening_questions (job_id, question_id, position, required, enabled)
       VALUES (?, ?, ?, ?, ?)`
    );
    input.forEach((n, i) => {
      insert.run(jobId, n.question_id, i, n.required ? 1 : 0, n.enabled ? 1 : 0);
    });
  });
  tx();
  return effectiveQuestions(db, companyId, jobId);
}

export function validateQuestionInput(body) {
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : '';
  if (!label) throw new ScreenQuestionValidation('label is required');
  const type = QUESTION_TYPES[body.type] ? body.type : 'text';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : null;
  let options = [];
  if (type === 'single' || type === 'multiple') {
    const raw = Array.isArray(body.options) ? body.options : [];
    options = raw
      .filter((o) => o && typeof o === 'object' && typeof o.label === 'string' && typeof o.value === 'string')
      .slice(0, MAX_OPTIONS)
      .map((o) => ({
        value: o.value.trim().slice(0, MAX_OPTION_LENGTH),
        label: o.label.trim().slice(0, MAX_OPTION_LENGTH),
      }))
      .filter((o) => o.value && o.label);
    if (options.length < 2) throw new ScreenQuestionValidation('Choice questions need at least two options');
    const unique = new Set(options.map((o) => o.value));
    if (unique.size !== options.length) throw new ScreenQuestionValidation('Choice options must have unique values');
  }
  return {
    label,
    type,
    description: description || null,
    options,
    default_enabled: body.default_enabled ? 1 : 0,
    default_required: body.default_required ? 1 : 0,
  };
}

export class ScreenQuestionValidation extends Error {}