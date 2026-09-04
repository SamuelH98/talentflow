import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, rankCandidates, parseSkills } from '../src/matching.js';

const makeJob = (overrides = {}) => ({
  title: 'Software Engineer',
  skills: ['React', 'Node.js', 'PostgreSQL'],
  requirements: ['Build full-stack features', 'Write unit tests'],
  years_required: 3,
  ...overrides,
});

const makeCand = (overrides = {}) => ({
  name: 'Test Candidate',
  skills: ['React', 'Node.js'],
  years_experience: 4,
  summary: 'Full-stack developer who builds features and writes tests.',
  ...overrides,
});

test('perfect match scores 100', () => {
  const { score } = scoreCandidate(makeJob(), makeCand({ skills: ['React', 'Node.js', 'PostgreSQL'], years_experience: 5 }));
  assert.equal(score, 100);
});

test('candidate with no matching skills scores low', () => {
  const { score } = scoreCandidate(makeJob(), makeCand({ skills: ['Cooking'], years_experience: 1 }));
  assert.ok(score < 40, `expected <40, got ${score}`);
});

test('partial skill match produces intermediate score', () => {
  const { score } = scoreCandidate(makeJob(), makeCand({ skills: ['React'] }));
  const { score: higher } = scoreCandidate(makeJob(), makeCand({ skills: ['React', 'Node.js'] }));
  assert.ok(score < higher);
  assert.ok(score > 0);
});

test('years experience meeting requirement scales score to 100', () => {
  const { score } = scoreCandidate(makeJob({ years_required: 3 }), makeCand({ years_experience: 3, skills: ['React', 'Node.js', 'PostgreSQL'] }));
  assert.equal(score, 100);
});

test('synonyms expand skills (JavaScript matches js)', () => {
  const { score } = scoreCandidate(makeJob({ skills: ['JavaScript'] }), makeCand({ skills: ['JS'] }));
  assert.equal(score, 100);
});

test('rankCandidates returns sorted matches per job', () => {
  const jobs = [makeJob()];
  const candidates = [
    makeCand({ skills: ['React', 'Node.js'] }),
    makeCand({ skills: ['Cooking'] }),
  ];
  const ranked = rankCandidates(jobs, candidates);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].matches.length, 2);
  assert.ok(ranked[0].matches[0].score > ranked[0].matches[1].score);
});

test('parseSkills handles both arrays and JSON strings', () => {
  assert.deepEqual(parseSkills(['a', 'b']), ['a', 'b']);
  assert.deepEqual(parseSkills('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseSkills('not json'), []);
  assert.deepEqual(parseSkills(null), []);
});

test('scoreCandidate handles missing job/candidate gracefully', () => {
  assert.equal(scoreCandidate(null, {}).score, 0);
  assert.equal(scoreCandidate({}, null).score, 0);
});