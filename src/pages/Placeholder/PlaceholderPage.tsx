import { Construction } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';

/** Stub for navigation targets outside the prototype's three built pages. */
export default function PlaceholderPage({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader eyebrow={eyebrow} title={title} description="This module is outside the current prototype scope." />
      <div className="panel mt-6">
        <EmptyState
          icon={<Construction size={19} strokeWidth={1.75} />}
          title="Not part of this prototype"
          description="Overview and Document Control are fully built. This screen is reserved for a later phase."
        />
      </div>
    </div>
  );
}
