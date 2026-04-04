import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getPortalAccount, updatePortalAccount } from '../../api/portal';
import { ThemePickerPanel } from '../../components/ThemePickerPanel';

type Form = {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export function PortalAccountPage() {
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const accountQuery = useQuery({
    queryKey: ['portal-account'],
    queryFn: getPortalAccount,
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({
    defaultValues: { email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  useEffect(() => {
    if (!accountQuery.data) return;
    reset((prev) => ({
      ...prev,
      email: accountQuery.data?.email ?? '',
    }));
  }, [accountQuery.data, reset]);

  const updateMutation = useMutation({
    mutationFn: (body: { email?: string; currentPassword?: string; newPassword?: string }) =>
      updatePortalAccount(body),
    onSuccess: async () => {
      toast.success('Account updated');
      await queryClient.invalidateQueries({ queryKey: ['portal-account'] });
      // Clear passwords in the form
      reset((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }));
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Could not update account');
    },
  });

  const newPassword = watch('newPassword');
  const confirmNewPassword = watch('confirmNewPassword');
  const canSetPasswordWithoutCurrent = Boolean(accountQuery.data?.canSetPasswordWithoutCurrent);

  const onSubmit = (f: Form) => {
    const email = f.email.trim().toLowerCase();
    const currentPassword = f.currentPassword.trim();
    const nextPass = f.newPassword.trim();
    const changingEmail = accountQuery.data?.email !== (email || null);
    const changingPassword = nextPass.length > 0;
    setJustSaved(false);
    setSaveMessage(null);

    const needsCurrentPassword = changingPassword && !canSetPasswordWithoutCurrent;

    if (needsCurrentPassword && !currentPassword) {
      toast.error('Current password is required');
      return;
    }

    if (nextPass && nextPass !== confirmNewPassword.trim()) {
      toast.error('New passwords do not match');
      return;
    }

    updateMutation.mutate(
      {
        email: email || undefined,
        currentPassword,
        newPassword: nextPass || undefined,
      },
      {
        onSuccess: () => {
          setJustSaved(true);
          window.setTimeout(() => setJustSaved(false), 4000);
          if (changingPassword && changingEmail) {
            setSaveMessage('Password and login email saved.');
          } else if (changingPassword) {
            setSaveMessage('Password saved.');
          } else if (changingEmail) {
            setSaveMessage('Login email saved.');
          } else {
            setSaveMessage('No changes to save.');
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-text">Account</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Set a login email (username) and update your portal password.
        </p>
      </div>

      <ThemePickerPanel description="Color theme for the client portal and main vendor app in this browser (not the admin panel)." />

      {accountQuery.isPending && <p className="text-text-muted">Loading account…</p>}
      {accountQuery.isError && <p className="text-red-600">Could not load account.</p>}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-text mb-1">Login email</label>
          <input
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full px-3 py-2 border border-input-border rounded-lg"
            placeholder="you@example.com"
          />
          <p className="text-xs text-text-secondary mt-1">
            Once set, you can sign in using Email + Password on the portal login page.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Current portal password {canSetPasswordWithoutCurrent ? '(optional)' : '*'}
          </label>
          <input
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
            className="w-full px-3 py-2 border border-input-border rounded-lg"
          />
          {canSetPasswordWithoutCurrent ? (
            <p className="text-xs text-text-secondary mt-1">
              You signed in with an access token, so you can set a new password without the current one.
            </p>
          ) : errors.currentPassword ? (
            <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              className="w-full px-3 py-2 border border-input-border rounded-lg"
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirmNewPassword')}
              className="w-full px-3 py-2 border border-input-border rounded-lg"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        {Boolean(newPassword || confirmNewPassword) && newPassword.trim().length > 0 && newPassword.trim().length < 8 && (
          <p className="text-text text-sm bg-surface-alt border border-border rounded-lg px-3 py-2">
            New passwords must be at least 8 characters.
          </p>
        )}

        {saveMessage && (
          <p className="text-sm text-text bg-surface-alt border border-border rounded-lg px-3 py-2">
            {saveMessage}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className={`px-5 py-2.5 text-white rounded-lg disabled:opacity-50 text-sm font-medium shadow-sm transition-colors ${
              justSaved
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700'
                : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {updateMutation.isPending ? 'Saving…' : justSaved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

