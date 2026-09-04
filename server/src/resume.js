import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// Local, dependency-free resume parsing: extract text from .pdf / .docx / .txt
// and heuristically pull out the fields needed by the application form.
// Best-effort by design: no OCR, so scanned/image-only PDFs yield empty text.

const DEFAULT_SKILLS = {
  javascript: ['javascript', ' js ', 'ecmascript', 'es6', 'es2015'],
  typescript: ['typescript', ' ts '],
  react: ['react', 'react.js', 'reactjs'],
  vue: ['vue', 'vue.js', 'vuejs', 'nuxt'],
  svelte: ['svelte'],
  node: ['node.js', 'nodejs', 'node'],
  express: ['express.js', 'express', 'fastify', 'koa'],
  angular: ['angular'],
  nextjs: ['next.js', 'nextjs'],
  html: ['html'],
  css: ['css', 'scss', 'sass', 'tailwind'],
  python: ['python', 'django', 'flask', 'fastapi'],
  java: ['java'],
  kotlin: ['kotlin'],
  swift: ['swift'],
  go: ['go', 'golang'],
  rust: ['rust'],
  c: [' c ', 'c++', 'cpp', 'c#', 'csharp'],
  sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'oracle'],
  nosql: ['mongodb', 'mongo', 'redis', 'dynamodb', 'cassandra', 'nosql'],
  aws: ['aws', 'amazon web services', 's3', 'ec2', 'lambda'],
  azure: ['azure'],
  gcp: ['gcp', 'google cloud'],
  docker: ['docker', 'container', 'kubernetes', 'k8s', 'terraform'],
  git: ['git', 'github', 'gitlab'],
  graphql: ['graphql', 'apollo'],
  rest: ['rest api', 'restful'],
  testing: ['jest', 'mocha', 'pytest', 'playwright', 'cypress', 'selenium', 'junit', 'testing'],
  ci: ['ci/cd', 'jenkins', 'github actions', 'circleci'],
  agile: ['agile', 'scrum', 'kanban'],
  data_analysis: ['pandas', 'numpy', 'r ', 'tableau', 'power bi', 'excel'],
  ml: ['machine learning', 'tensorflow', 'pytorch', 'scikit', 'llm', 'nlp'],
  devops: ['devops', 'sre', 'observability', 'datadog', 'grafana', 'prometheus'],
  security: ['security', 'penetration testing', 'owasp', 'auth', 'oauth'],
  leadership: ['leadership', 'team lead', 'mentoring', 'staff engineer'],
};

const SKILL_API = Object.entries(DEFAULT_SKILLS).map(([skill, aliases]) => ({ skill, aliases }));
const SKILL_ALIASES = SKILL_API.flatMap(({ skill, aliases }) => aliases.map((a) => ({ alias: a.trim(), skill })))
  .sort((a, b) => b.alias.length - a.alias.length);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class UnsupportedResumeError extends Error {
  constructor(ext) {
    super(`Unsupported file type: ${ext || 'unknown'}. Please upload a .pdf, .docx, or .txt file.`);
    this.name = 'UnsupportedResumeError';
    this.ext = ext;
  }
}

export async function extractTextFromFile({ buffer, ext }) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'txt') return buffer.toString('utf8');
  if (e === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  if (e === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }
  throw new UnsupportedResumeError(e);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const YEARS_RE = /(\d{1,2})\s*(?:\+|-)?\s*(?:to\s*\d{1,2}\s*)?(?:years|yrs)(?:\s+of)?\s+experience/ig;
const SUMMARY_HEADERS = /^.*\b(professional summary|summary|profile|objective|about|career summary)\b.*$/i;
const SECTION_HEADER_RE = /^(education|experience|work experience|skills|projects|employment|technical skills|certifications?|languages)$/i;

function nameLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const skipRe = /^(curriculum vitae|cv|r[eé]sum[eé]|resume|cv|applicant|name:)\b/i;
  for (const line of lines) {
    if (line.length > 60) continue;
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (skipRe.test(line)) continue;
    if (line.includes('|') && line.split('|').length >= 3) continue;
    if (!/[A-Za-z]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length > 5) continue;
    if (words.every((w) => w.toUpperCase() === w)) continue;
    return line;
  }
  return null;
}

export function parseResumeText(text = '') {
  const normalized = String(text).replace(/\r\n/g, '\n');
  const lower = normalized.toLowerCase();

  const emailMatch = normalized.match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;

  let phone = null;
  const phoneMatch = normalized.match(PHONE_RE);
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/\D/g, '');
    if (digits.length >= 10) {
      phone = digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : `+${digits}`;
    }
  }

  let years_experience = null;
  const yearMatches = [...normalized.matchAll(YEARS_RE)];
  if (yearMatches.length > 0) {
    const nums = yearMatches.map((m) => parseInt(m[1], 10)).filter((n) => n >= 1 && n <= 40);
    if (nums.length > 0) years_experience = Math.max(...nums);
  }

  const skills = [];
  for (const { alias, skill } of SKILL_ALIASES) {
    if (skills.includes(skill)) continue;
    if (new RegExp(`(?<![a-z0-9])${escapeRe(alias)}(?![a-z0-9])`, 'i').test(lower)) skills.push(skill);
  }

  let summary = null;
  const lines = normalized.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (SUMMARY_HEADERS.test(lines[i])) {
      const buf = [];
      for (let j = i + 1; j < lines.length && buf.join(' ').length < 420; j++) {
        const l = lines[j].trim();
        if (!l) break;
        if (SECTION_HEADER_RE.test(l) || /\b(education|experience|technical skills)\b:?$/i.test(l)) break;
        buf.push(l);
      }
      summary = buf.join(' ').slice(0, 500) || null;
      break;
    }
  }

  let location = null;
  const locRe = /(?:^|\n)\s*([\w. ]+,\s+[A-Z]{2}(?:\s+\d{5})?)\b/;
  const locMatch = normalized.match(locRe);
  if (locMatch) location = locMatch[1].trim();

  let name = nameLine(normalized);
  if (name && location && name.includes(location)) name = null;

  return {
    name: name || null,
    email,
    phone,
    location,
    years_experience,
    skills,
    summary,
  };
}

export async function readResume({ buffer, filename }) {
  const ext = String((filename || '').split('.').pop() || '').toLowerCase();
  const text = await extractTextFromFile({ buffer, ext });
  return { ext, text, fields: parseResumeText(text) };
}