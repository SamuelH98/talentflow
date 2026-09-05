import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function seed(db = createDb(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'talentflow.db'))) {

const company = db.prepare('SELECT * FROM companies WHERE name = ?').get('Acme Talent Co');
let companyId;
if (company) {
  companyId = company.id;
} else {
  companyId = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Acme Talent Co').lastInsertRowid;
}

const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
    companyId, 'Demo Recruiter', 'demo@acmetalent.com', bcrypt.hashSync('password', 10), 'recruiter'
  );
}

const candCount = db.prepare('SELECT COUNT(*) AS n FROM candidates').get().n;
if (candCount === 0) {
  const insertCand = db.prepare(
    `INSERT INTO candidates (company_id, name, email, phone, location, title, summary, years_experience, skills, experience, education, resume_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const candidates = [
    {
      name: 'Sara Chen', email: 'sara.chen@email.com', phone: '555-0101', location: 'Austin, TX',
      title: 'Senior Full-Stack Engineer', summary: '10+ years building web apps across React, Node and Postgres.',
      years_experience: 10, skills: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'AWS', 'CI/CD'],
      experience: ['Led platform team at FinTech Inc (5 yrs)', 'Full-stack dev at ShopCo (4 yrs)', 'Backend engineer at DataWorks (2 yrs)'],
      education: ['B.S. Computer Science, UT Austin'], resume_text: 'Full-stack engineering leader focused on React, TypeScript, Node.js, Postgres and AWS pipelines.',
    },
    {
      name: 'Miguel Ortega', email: 'miguel.o@email.com', phone: '555-0102', location: 'Remote',
      title: 'Full-Stack Developer', summary: 'Full-stack developer with a passion for clean APIs and React frontends.',
      years_experience: 4, skills: ['React', 'JavaScript', 'Node.js', 'Express', 'MongoDB', 'CSS'],
      experience: ['Full-stack dev at Startuply (3 yrs)', 'React intern at WebAgency (1 yr)'],
      education: ['B.A. Computer Science, Cal State'], resume_text: 'React and Node full-stack developer experienced building REST APIs and responsive UIs.',
    },
    {
      name: 'Priya Patil', email: 'priya.p@email.com', phone: '555-0103', location: 'Seattle, WA',
      title: 'Machine Learning Engineer', summary: 'ML engineer focused on NLP and recommendation systems using Python and PyTorch.',
      years_experience: 6, skills: ['Python', 'PyTorch', 'TensorFlow', 'Machine Learning', 'AWS', 'SQL', 'Docker'],
      experience: ['ML engineer at InsightLab (4 yrs)', 'Data scientist at RetailAI (2 yrs)'],
      education: ['M.S. Machine Learning, UW Seattle'], resume_text: 'Machine learning engineer building NLP and recommender systems in Python and PyTorch.',
    },
    {
      name: 'Tom Bradley', email: 'tom.b@email.com', phone: '555-0104', location: 'Chicago, IL',
      title: 'React Developer', summary: 'Frontend specialist crafting accessible, high-performance React interfaces.',
      years_experience: 3, skills: ['React', 'CSS', 'HTML', 'JavaScript', 'Jest'],
      experience: ['Frontend dev at PixelPress (3 yrs)'],
      education: ['B.S. Web Development, DePaul'], resume_text: 'React developer focused on accessible, performant UI and component libraries.',
    },
    {
      name: 'Aisha Khan', email: 'aisha.k@email.com', phone: '555-0105', location: 'New York, NY',
      title: 'Backend Engineer', summary: 'Backend engineer specializing in Node.js, Postgres and distributed systems.',
      years_experience: 7, skills: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL', 'Redis'],
      experience: ['Backend lead at CloudNine (5 yrs)', 'Software engineer at FinServe (2 yrs)'],
      education: ['B.S. Computer Engineering, NYU'], resume_text: 'Backend engineer with deep Node.js and database expertise across high-traffic services.',
    },
    {
      name: 'Leo Fontaine', email: 'leo.f@email.com', phone: '555-0106', location: 'Paris, FR',
      title: 'Mobile Engineer', summary: 'Mobile engineer specializing in React Native and iOS development.',
      years_experience: 5, skills: ['React Native', 'Swift', 'iOS', 'TypeScript', 'Firebase'],
      experience: ['Mobile engineer at AppLair (3 yrs)', 'iOS developer at MoveFast (2 yrs)'],
      education: ['M.S. Mobile Computing, École 42'], resume_text: 'React Native and native iOS engineer shipping consumer apps at scale.',
    },
    {
      name: 'Grace Liu', email: 'grace.liu@email.com', phone: '555-0107', location: 'San Francisco, CA',
      title: 'Data Scientist', summary: 'Data scientist turning messy data into models and clear insights.',
      years_experience: 4, skills: ['Python', 'SQL', 'Pandas', 'Machine Learning', 'Tableau', 'Statsmodels'],
      experience: ['Data scientist at MetricsFirst (3 yrs)', 'Data analyst at RetailBank (1 yr)'],
      education: ['B.S. Statistics, UC Berkeley'], resume_text: 'Data scientist experienced in Python, SQL, statistics and ML modeling for business decisions.',
    },
    {
      name: 'Daniel Osei', email: 'daniel.o@email.com', phone: '555-0108', location: 'Toronto, CA',
      title: 'DevOps Engineer', summary: 'DevOps engineer automating cloud infrastructure with Docker, Kubernetes and AWS.',
      years_experience: 6, skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux', 'Python'],
      experience: ['DevOps engineer at CloudWorks (4 yrs)', 'Site reliability at NetHost (2 yrs)'],
      education: ['B.S. Systems Engineering, U Toronto'], resume_text: 'DevOps and SRE engineer focused on Kubernetes, Terraform, AWS and CI/CD automation.',
    },
    {
      name: 'Hannah Schmidt', email: 'hannah.s@email.com', phone: '555-0109', location: 'Berlin, DE',
      title: 'Full-Stack Engineer', summary: 'Polyglot engineer who ships full-stack features in React, Node and TypeScript.',
      years_experience: 5, skills: ['React', 'Node.js', 'TypeScript', 'GraphQL', 'PostgreSQL', 'Docker'],
      experience: ['Full-stack engineer at TechNest (4 yrs)', 'Junior dev at LocalApps (1 yr)'],
      education: ['M.S. Computer Science, TU Berlin'], resume_text: 'Full-stack engineer building products with React, Node.js, TypeScript and GraphQL.',
    },
    {
      name: 'Omar Farouk', email: 'omar.f@email.com', phone: '555-0110', location: 'Dubai, AE',
      title: 'React/TypeScript Developer', summary: 'TypeScript-first frontend developer with strong React and test coverage habits.',
      years_experience: 3, skills: ['React', 'TypeScript', 'Jest', 'CSS', 'JavaScript', 'Node.js'],
      experience: ['Frontend developer at GulfTech (3 yrs)'],
      education: ['B.S. Software Engineering, AUS'], resume_text: 'TypeScript-first React developer focused on testability and component architecture.',
    },
  ];

  const tx = db.transaction(() => {
    for (const c of candidates) {
      insertCand.run(
        companyId, c.name, c.email, c.phone, c.location, c.title, c.summary,
        c.years_experience, JSON.stringify(c.skills), JSON.stringify(c.experience), JSON.stringify(c.education), c.resume_text
      );
    }
  });
  tx();
}

const jobCount = db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n;
if (jobCount === 0) {
  const insertJob = db.prepare(
    `INSERT INTO jobs (company_id, title, department, location, description, requirements, skills, years_required, min_salary, max_salary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const jobs = [
    {
      title: 'Senior Full-Stack Engineer', department: 'Engineering', location: 'Austin, TX (Hybrid)',
      description: 'Own features end to end across a React + Node.js codebase in a fast-moving product team.',
      requirements: ['Architect and build full-stack features', 'Mentor junior engineers', 'Collaborate with product and design'],
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'], years_required: 5, min_salary: 150000, max_salary: 190000,
    },
    {
      title: 'Frontend Developer (React)', department: 'Engineering', location: 'Remote (US)',
      description: 'Build polished, accessible UI components and own our design system.',
      requirements: ['Implement accessible UI components', 'Work closely with designers', 'Write unit tests with Jest'],
      skills: ['React', 'CSS', 'JavaScript', 'Jest', 'HTML'], years_required: 2, min_salary: 110000, max_salary: 140000,
    },
    {
      title: 'Machine Learning Engineer', department: 'Data', location: 'Seattle, WA',
      description: 'Ship production ML models for our recommendation engine.',
      requirements: ['Train and deploy ML models', 'Own model monitoring', 'Partner with data engineering'],
      skills: ['Python', 'PyTorch', 'Machine Learning', 'AWS', 'Docker'], years_required: 3, min_salary: 130000, max_salary: 170000,
    },
    {
      title: 'Backend Engineer (Node.js)', department: 'Engineering', location: 'Remote',
      description: 'Design APIs and services powering our core platform.',
      requirements: ['Design REST and GraphQL APIs', 'Optimize Postgres queries', 'Build resilient background jobs'],
      skills: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'AWS'], years_required: 4, min_salary: 135000, max_salary: 165000,
    },
  ];
  const tx = db.transaction(() => {
    for (const j of jobs) {
      insertJob.run(
        companyId, j.title, j.department, j.location, j.description,
        JSON.stringify(j.requirements), JSON.stringify(j.skills), j.years_required, j.min_salary, j.max_salary
      );
    }
  });
  tx();
}

const qCount = db.prepare('SELECT COUNT(*) AS n FROM screening_questions WHERE company_id = ?').get(companyId).n;
if (qCount === 0) {
  const insertQ = db.prepare(
    `INSERT INTO screening_questions (company_id, label, description, type, options, default_enabled, default_required, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const questions = [
    {
      label: 'How did you hear about this role?', description: 'A quick one-liner is fine.', type: 'text',
      options: [], default_enabled: 1, default_required: 0,
    },
    {
      label: 'Are you legally authorized to work in the country where this role is located?',
      description: null, type: 'single',
      options: [
        { value: 'yes', label: 'Yes, on a permanent basis' },
        { value: 'sponsor', label: 'Yes, but I will need visa sponsorship' },
        { value: 'no', label: 'No' },
      ],
      default_enabled: 1, default_required: 1,
    },
    {
      label: 'Tell us about a project you are especially proud of.',
      description: 'What did you build, and what was your impact?', type: 'paragraph',
      options: [], default_enabled: 0, default_required: 0,
    },
  ];
  questions.forEach((q, i) => {
    insertQ.run(companyId, q.label, q.description, q.type, JSON.stringify(q.options), q.default_enabled, q.default_required, i);
  });
}

const appCount = db.prepare('SELECT COUNT(*) AS n FROM applications').get().n;
if (appCount === 0) {
  const rows = db
    .prepare(
      `SELECT c.id AS cid, c.name AS cname, c.email AS cemail, j.id AS jid, j.title AS jtitle
       FROM candidates c, jobs j
       WHERE c.company_id = ? AND j.company_id = ?`
    )
    .all(companyId, companyId);
  const byTitle = (t) => rows.find((r) => r.jtitle === t);
  const byName = (n) => rows.find((r) => r.cname === n);
  const pick = (cname, jtitle, status, daysAgo) => {
    const c = byName(cname);
    const j = byTitle(jtitle);
    if (!c || !j) return;
    const applied = new Date(Date.now() - daysAgo * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    db.prepare(
      `INSERT INTO applications (job_id, candidate_id, tracking_token, status, status_updated_at, created_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(j.cid, c.cid, crypto.randomUUID(), status, applied, applied,
      status === 'interview' ? 'Scheduled technical screen' : null);
  };
  pick('Sara Chen', 'Senior Full-Stack Engineer', 'in_review', 3);
  pick('Hannah Schmidt', 'Senior Full-Stack Engineer', 'interview', 5);
  pick('Miguel Ortega', 'Frontend Developer (React)', 'in_review', 1);
  pick('Tom Bradley', 'Frontend Developer (React)', 'interview', 6);
  pick('Priya Patil', 'Machine Learning Engineer', 'interview', 4);
  pick('Grace Liu', 'Machine Learning Engineer', 'in_review', 2);
  pick('Aisha Khan', 'Backend Engineer (Node.js)', 'hired', 12);
  pick('Daniel Osei', 'Backend Engineer (Node.js)', 'matched', 0);

  const qs = db
    .prepare('SELECT id, label FROM screening_questions WHERE company_id = ?')
    .all(companyId)
    .reduce((m, q) => ({ ...m, [q.label]: q.id }), {});
  const qid = (label) => qs[label];
  const addAnswers = (cname, screening) => {
    const app = db
      .prepare(
        `SELECT a.id FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         WHERE c.name = ? ORDER BY a.created_at DESC LIMIT 1`
      )
      .get(cname);
    if (!app) return;
    db.prepare('INSERT INTO application_answers (application_id, data) VALUES (?, ?)').run(
      app.id,
      JSON.stringify({ eeo: {}, screening })
    );
  };
  if (qid('How did you hear about this role?')) {
    addAnswers('Sara Chen', {
      [qid('How did you hear about this role?')]: 'Saw the role on a tech job board and checked out your careers page.',
      [qid('Are you legally authorized to work in the country where this role is located?')]: 'yes',
    });
    addAnswers('Aisha Khan', {
      [qid('How did you hear about this role?')]: 'Referred by a former teammate on the platform team.',
      [qid('Are you legally authorized to work in the country where this role is located?')]: 'yes',
    });
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  seed();
  console.log('Seed complete.');
  console.log('Login: demo@acmetalent.com / password');
}
}