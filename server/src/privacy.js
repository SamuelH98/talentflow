export const POLICY_VERSION = '2026-09-01';

export const PRIVACY_NOTICE = [
  'We store the details you provide — name, contact information, your resume, and your answers to application questions — so our hiring team can evaluate your application for this role and, unless you object, for future roles.',
  'Your resume and interview screening answers are shared only with the hiring team, never with other candidates. Your self-identification (EEO) answers are collected for compliance reporting, are optional, and are never used for hiring decisions or shared with the hiring team.',
  'You can ask us to export or delete your data at any time from the application tracking page ("Manage my data").',
].join(' ');

export function formatPolicyVersion(v = POLICY_VERSION) {
  return new Date(v + 'T00:00:00Z').toISOString().slice(0, 10);
}