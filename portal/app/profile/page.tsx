import { getProfile } from '@/lib/queries';
import { ProfileForm } from './profile-form';


export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getProfile();
  return (
    <div className="px-8 py-6 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Profile</h1>
        <p className="text-sm text-zinc-500">
          Your CV and goals — used by every evaluation. Stored in Supabase.
        </p>
      </header>
      <ProfileForm
        initialCv={profile?.cv_md ?? ''}
        initialGoals={profile?.goals_md ?? ''}
      />
    </div>
  );
}
