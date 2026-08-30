import { ConsoleClient } from './ConsoleClient';
import { ImportPanel } from './_components/ImportPanel';
import { FIXTURE_JOBS, FIXTURE_PERSONAS } from '@/lib/council/fixtures';

export default function Page() {
  // Fixtures for now. This becomes a TrueForge session read once the harness
  // client lands. See docs/ARCHITECTURE.md, "seams".
  return (
    <>
      <ConsoleClient personas={FIXTURE_PERSONAS} jobs={FIXTURE_JOBS} />
      <ImportPanel />
    </>
  );
}
