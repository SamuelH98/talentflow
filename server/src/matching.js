const SYNONYMS = {
  js: ['javascript', 'js', 'es6', 'es2015', 'nodejs', 'node.js'],
  jsx: ['react', 'reactjs', 'react.js', 'jsx'],
  ts: ['typescript', 'ts'],
  'node.js': ['node', 'nodejs', 'express', 'backend'],
  fullstack: ['full-stack', 'full stack', 'frontend', 'backend', 'node.js'],
  frontend: ['front-end', 'front end', 'ui', 'react', 'css', 'html'],
  backend: ['back-end', 'back end', 'api', 'node.js', 'server'],
  python: ['python', 'django', 'flask'],
  cloud: ['aws', 'azure', 'gcp', 'cloud'],
  ci: ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci'],
  ml: ['machine learning', 'ml', 'data science', 'tensorflow', 'pytorch'],
  sql: ['sql', 'postgres', 'postgresql', 'mysql', 'relational database'],
  nosql: ['mongo', 'mongodb', 'dynamodb', 'cassandra'],
  mobile: ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
};

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\/-]/g, ' ')
    .trim();
}

export function tokenizeSkills(skills) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of skills) {
    const base = norm(raw);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
    for (const [key, alts] of Object.entries(SYNONYMS)) {
      const canon = norm(key);
      if (alts.includes(base) || base === canon) {
        for (const t of [canon, ...alts]) {
          if (!seen.has(t)) {
            seen.add(t);
            out.push(t);
          }
        }
      }
    }
  }
  return out;
}

export function parseSkills(serialized) {
  if (Array.isArray(serialized)) return serialized;
  try {
    const parsed = JSON.parse(serialized || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function scoreCandidate(job, candidate, { verbose = false } = {}) {
  if (!job || !candidate) return { score: 0, breakdown: null };

  const jobSkills = tokenizeSkills(parseSkills(job.skills));
  const candidateSkills = tokenizeSkills(parseSkills(candidate.skills));
  const candSkillSet = new Set(candidateSkills);

  const skillHits = jobSkills.filter((s) => candSkillSet.has(s));
  const skillScore =
    jobSkills.length === 0 ? 0 : skillHits.length / jobSkills.length;

  const years = Number(candidate.years_experience) || 0;
  const yearsRequired = Number(job.years_required) || 0;
  const yearsScore = yearsRequired <= 0 ? 1 : Math.min(1, years / yearsRequired);

  let expScore = 0;
  let expHits = [];
  if (Array.isArray(job.requirements) && job.requirements.length) {
    const candText = norm(
      [candidate.summary, candidate.resume_text || '', ...(candidate.experience || [])]
        .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
        .join(' ')
    );
    const jobReqs = (job.requirements || []).map((r) => norm(r));
    for (const req of jobReqs) {
      const hits = req.split(' ').filter((w) => w.length > 2 && candText.includes(w));
      if (hits.length >= Math.max(1, Math.ceil(req.split(' ').filter((w) => w.length > 2).length / 2))) {
        expHits.push(req);
      }
    }
    expScore = expHits.length / jobReqs.length;
  } else {
    expScore = 1;
  }

  const score = Math.round((skillScore * 0.5 + yearsScore * 0.2 + expScore * 0.3) * 100);

  if (!verbose) return { score };
  return {
    score,
    breakdown: {
      skillScore: Math.round(skillScore * 100),
      skillHits,
      requiredSkills: jobSkills,
      yearsScore: Math.round(yearsScore * 100),
      years,
      yearsRequired,
      expScore: Math.round(expScore * 100),
      expHits,
    },
  };
}

export function rankCandidates(jobs, candidates) {
  const ranked = [];
  for (const job of jobs) {
    const matches = candidates
      .filter((c) => c.status !== 'archived')
      .map((candidate) => {
        const { score, breakdown } = scoreCandidate(job, candidate, { verbose: true });
        return { candidate, score, breakdown };
      })
      .sort((a, b) => b.score - a.score);
    ranked.push({ job, matches });
  }
  return ranked;
}