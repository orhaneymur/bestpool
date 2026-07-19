/** Standard Section III clauses (modeled on commercial pool management contracts). */
export const STANDARD_CLAUSES = [
  {
    label: 'A',
    body: 'This contract includes Health Department required permit, test kit and reagents.',
  },
  {
    label: 'B',
    body: 'This contract includes additional winterization services (blowing out skimmer lines, winterizing algaecide and pool pump motor storage).',
  },
  {
    label: 'C',
    body: 'Cost for additional lifeguard hours (more than 48 hours notice): $35/hr.',
  },
  {
    label: 'D',
    body: 'Cost for additional lifeguard hours (less than 48 hours notice): $50/hr.',
  },
  {
    label: 'E',
    body: 'Upon contract execution, the CONTRACTOR will conduct two service visits per month during the off-season.',
  },
  {
    label: 'F',
    body: 'The CONTRACTOR will schedule and attend all health department inspections.',
  },
  {
    label: 'G',
    body: 'The CONTRACTOR will conduct random safety checks and in-service training.',
  },
  {
    label: 'H',
    body: 'Contract includes pool opening and closing. This contract will expire once the pool winterization has been completed.',
  },
  {
    label: 'I',
    body: 'All lifeguards have current certifications in Lifeguarding, First Aid, CPR and AED issued by Ellis & Associates or American Red Cross.',
  },
];

export function cloneStandardClauses() {
  return STANDARD_CLAUSES.map((c) => ({ ...c }));
}
