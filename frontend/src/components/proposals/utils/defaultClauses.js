/** Specification page — default Additional Comments (client Software Spec). */
export const STANDARD_CLAUSES = [
  {
    label: 'A',
    body: 'Test kit restock included.',
  },
  {
    label: 'B',
    body: 'First aid kit restock included.',
  },
  {
    label: 'C',
    body: 'Cost for additional lifeguard hours (more than 48 hours notice): $35/hr.',
  },
  {
    label: 'D',
    body: 'Cost for additional lifeguard hours (less than 48 hours notice): $55/hr.',
  },
  {
    label: 'E',
    body: 'Upon contract execution, the CONTRACTOR will conduct two service visits per month during the off-season.',
  },
  {
    label: 'F',
    body: 'The CONTRACTOR will schedule and attend all Health Department inspections.',
  },
  {
    label: 'G',
    body: 'The CONTRACTOR will conduct random safety inspections and in-service training.',
  },
  {
    label: 'H',
    body: 'Contract includes pool opening and closing. This contract will expire once the pool winterization has been completed.',
  },
  {
    label: 'I',
    body: 'Chemicals included for disinfectant and pH compliance.',
  },
  {
    label: 'J',
    body: 'The CONTRACTOR will conduct a minimum of three (3) inspections per week during the regular pool season.',
  },
  {
    label: 'K',
    body: 'All lifeguards have current certifications in Lifeguarding, First Aid, CPR and AED issued by Ellis & Associates or American Red Cross.',
  },
];

export function cloneStandardClauses() {
  return STANDARD_CLAUSES.map((c) => ({ ...c }));
}
