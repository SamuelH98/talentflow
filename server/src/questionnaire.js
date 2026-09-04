// Voluntary self-identification questions shown on the public application form.
// Wording follows the standard U.S. EEO forms (SF-181 race/ethnicity, VETS-4212
// veteran status, Section 503 disability self-identification) as surfaced in
// Workday's candidate application flow. All questions are optional.
//
// NOTE: answers are intentionally NOT returned by recruiter endpoints or the
// public status tracker — they are stored so an EEO report can be added later.

export const QUESTIONNAIRE_VERSION = 1;

export const QUESTIONNAIRE_PRIVACY =
  'These questions are voluntary and are never used to make a hiring decision. ' +
  'Your answers are kept confidential and are reviewed only in aggregate for equal employment ' +
  'opportunity reporting. Declining to answer will not affect your application in any way.';

export const QUESTIONNAIRE = [
  {
    key: 'current_employee',
    title: 'Do you currently work for the company?',
    sub: 'Answer "Yes" only if you are currently an active employee of the company you are applying to.',
    type: 'single',
    options: [
      { value: 'yes', label: 'Yes, I currently work for the company' },
      { value: 'no', label: 'No' },
      { value: 'decline', label: 'Prefer not to say' },
    ],
  },
  {
    key: 'gender',
    title: 'Gender identity',
    type: 'single-detail',
    detailField: 'gender_detail',
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
      { value: 'nonbinary', label: 'Non-binary' },
      { value: 'self_identify', label: 'Self-identify', detail: true },
      { value: 'decline', label: 'Prefer not to say' },
    ],
  },
  {
    key: 'race_ethnicity',
    title: 'Race & ethnicity',
    type: 'single',
    options: [
      { value: 'hispanic_latino', label: 'Hispanic or Latino' },
      { value: 'white', label: 'White (Not Hispanic or Latino)' },
      { value: 'black_aa', label: 'Black or African American (Not Hispanic or Latino)' },
      { value: 'asian', label: 'Asian (Not Hispanic or Latino)' },
      { value: 'nhpi', label: 'Native Hawaiian or Other Pacific Islander (Not Hispanic or Latino)' },
      { value: 'aian', label: 'American Indian or Alaska Native (Not Hispanic or Latino)' },
      { value: 'two_or_more', label: 'Two or More Races (Not Hispanic or Latino)' },
      { value: 'decline', label: 'Decline to self-identify' },
    ],
  },
  {
    key: 'veteran_status',
    title: 'Veteran status (U.S.)',
    type: 'single',
    sub: 'The following form is presented in accordance with the Vietnam Era Veterans\u2019 Readjustment Assistance Act (VEVRAA), 38 U.S.C. 4212 and its implementing regulation, 41 CFR 60-300.5(a).',
    options: [
      { value: 'protected_veteran', label: 'I identify as one or more of the classifications of protected veterans \u2014 a disabled veteran, recently separated veteran, active-duty wartime or campaign-badge veteran, or Armed Forces service medal veteran' },
      { value: 'veteran_not_protected', label: 'I identify as a veteran, just not a protected veteran' },
      { value: 'decline', label: 'I do not wish to self-identify' },
    ],
    disclosure:
      'If you believe you belong to any of the categories of protected veterans listed above and wish to be ' +
      'considered as such, please self-identify by selecting the applicable option. Federal contractors are ' +
      'required by law to invite applicants to self-identify for affirmative action purposes. This form is ' +
      'voluntary, and your decision to complete it will not affect your consideration for employment. ' +
      'Answering will not be used to discriminate against you or subject you to any adverse treatment.',
  },
  {
    key: 'disability',
    title: 'Disability self-identification (Section 503)',
    type: 'single',
    sub: 'Form CC-305 \u2014 voluntary self-identification of disability.',
    options: [
      { value: 'yes', label: 'Yes, I have a disability (or have had one in the past)' },
      { value: 'no', label: 'No, I do not have a disability' },
      { value: 'decline', label: 'I don\u2019t wish to answer' },
    ],
    disclosure:
      'Why are we asking? Under the Rehabilitation Act of 1973 (Section 503), federal contractors and ' +
      'subcontractors must take affirmative action to employ and advance qualified individuals with ' +
      'disabilities. To measure this progress, we invite applicants to voluntarily identify whether they have ' +
      'a disability. Completion of this form is entirely voluntary, and whatever decision you make will not be ' +
      'used to discriminate against you or affect your application. The information you provide is kept ' +
      'confidential and is used only as permitted by law \u2014 for managing our affirmative action obligations, ' +
      'for workers\u2019 compensation or disability insurance claims, or if you request a workplace accommodation.',
  },
];

export function questionnairePublic() {
  return {
    version: QUESTIONNAIRE_VERSION,
    privacy: QUESTIONNAIRE_PRIVACY,
    questions: QUESTIONNAIRE.map((q) => ({
      key: q.key,
      title: q.title,
      sub: q.sub,
      type: q.type,
      detailField: q.detailField,
      options: q.options,
      disclosure: q.disclosure,
    })),
  };
}