import test from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { extractTextFromFile, parseResumeText, UnsupportedResumeError } from '../src/resume.js';

function makePdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length + 15} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

function makeDocx(paragraphs) {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  ));
  zip.addFile('_rels/.rels', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  ));
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  ));
  return zip.toBuffer();
}

const RESUME_TEXT = [
  'Jane Q. Engineering',
  'San Francisco, CA | jane.eng@example.dev | (415) 555-0192',
  '',
  'Professional Summary',
  'Full-stack engineer with 8+ years of experience building React and Node.js ',
  'applications at scale. Led a team of five, shipped GraphQL APIs, and cut infra ',
  'costs using AWS and Docker.',
  '',
  'Technical Skills',
  'JavaScript, TypeScript, React, Node.js, Express, PostgreSQL, GraphQL, Docker, AWS, Git',
  '',
  'Experience',
  'Senior Engineer, Acme (2019-present) Build and operate React SPA and Node services.',
].join('\n');

test('parseResumeText extracts contact + experience + skills + summary', () => {
  const f = parseResumeText(RESUME_TEXT);
  assert.equal(f.name, 'Jane Q. Engineering');
  assert.equal(f.email, 'jane.eng@example.dev');
  assert.equal(f.phone, '(415) 555-0192');
  assert.equal(f.years_experience, 8);
  assert.ok(f.skills.includes('react'));
  assert.ok(f.skills.includes('node'));
  assert.ok(f.skills.includes('graphql'));
  assert.ok(f.skills.includes('aws'));
  assert.ok(f.summary.includes('Full-stack engineer'));
  assert.equal(f.location, 'San Francisco, CA');
});

test('parseResumeText returns empty-safe fields for junk input', () => {
  const f = parseResumeText('12345\n\nno useful content\n');
  assert.equal(f.email, null);
  assert.equal(f.phone, null);
  assert.equal(f.years_experience, null);
  assert.deepEqual(f.skills, []);
  assert.equal(f.summary, null);
});

test('extractTextFromFile reads .txt files', async () => {
  const text = 'Plain text resume';
  const got = await extractTextFromFile({ buffer: Buffer.from(text), ext: 'txt' });
  assert.equal(got, text);
});

test('extractTextFromFile reads generated PDFs', async () => {
  const pdf = makePdf('Hello from a PDF resume, written by Jane');
  const got = await extractTextFromFile({ buffer: pdf, ext: 'pdf' });
  assert.match(got, /Hello from a PDF resume/);
});

test('extractTextFromFile reads generated DOCX files', async () => {
  const docx = makeDocx(['Jordan Sample', 'Senior Backend Engineer 6 years of experience', 'Skills: Python, PostgreSQL, Docker']);
  const got = await extractTextFromFile({ buffer: docx, ext: 'docx' });
  assert.match(got, /Jordan Sample/);
  assert.match(got, /Python/);
});

test('extractTextFromFile rejects unsupported extensions', async () => {
  await assert.rejects(
    () => extractTextFromFile({ buffer: Buffer.from('x'), ext: 'rtf' }),
    UnsupportedResumeError
  );
});

test('readResume wires extraction + parsing end to end', async () => {
  const { readResume } = await import('../src/resume.js');
  const out = await readResume({ buffer: Buffer.from(RESUME_TEXT), filename: 'jane.txt' });
  assert.equal(out.ext, 'txt');
  assert.equal(out.fields.name, 'Jane Q. Engineering');
  assert.equal(out.fields.email, 'jane.eng@example.dev');
});