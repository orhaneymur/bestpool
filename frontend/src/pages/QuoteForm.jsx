import { useParams, useSearchParams } from 'react-router-dom';
import ProposalWizard from '@/components/proposals/ProposalWizard.jsx';

/** Create / edit proposal — Proposal Wizard */
export default function QuoteForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  return <ProposalWizard id={id} initialCustomerId={sp.get('customer') || ''} />;
}
