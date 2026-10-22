import {loadDashboard} from '@/lib/training/load-data';
import TrainingDashboard from './training-dashboard';

export default async function Home() {
  const data = await loadDashboard().catch(() => null);

  return (
    <>
      <header className='border-b border-line'>
        <div
          className='mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 sm:px-8'>
          <h1 className='text-lg font-semibold'>Evidence školení</h1>
        </div>
      </header>

      {data ? (
        <TrainingDashboard data={data}/>
      ) : (
        <main id='hlavni-obsah' tabIndex={-1} className='mx-auto max-w-4xl px-5 py-8 sm:px-8'>
          <h2 className='text-base font-semibold'>Data se nepodařilo načíst</h2>
          <p className='mt-2 text-sm text-muted'>
            Zkontrolujte, zda složka data obsahuje všechny čtyři CSV soubory v očekávaném formátu.
          </p>
        </main>
      )}
    </>
  );
}
