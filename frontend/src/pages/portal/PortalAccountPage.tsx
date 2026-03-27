import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getPortalAccount, updatePortalAccount } from '../../api/portal';

type Form = {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export function PortalAccountPage() {
  const queryClient = useQueryClient();

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
    mutationFn: (body: { email?: string; currentPassword: string; newPassword?: string }) =>
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

  const onSubmit = (f: Form) => {
    const email = f.email.trim().toLowerCase();
    const currentPassword = f.currentPassword.trim();
    const nextPass = f.newPassword.trim();

    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }

    if (nextPass && nextPass !== confirmNewPassword.trim()) {
      toast.error('New passwords do not match');
      return;
    }

    updateMutation.mutate({
      email: email || undefined,
      currentPassword,
      newPassword: nextPass || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-gray-700 mt-1 text-sm">
          Set a login email (username) and update your portal password.
        </p>
      </div>

      {accountQuery.isPending && <p className="text-gray-500">Loading account…</p>}
      {accountQuery.isError && <p className="text-red-600">Could not load account.</p>}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-sky-100 shadow-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Login email</label>
          <input
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full px-3 py-2 border border-gray-400 rounded-lg"
            placeholder="you@example.com"
          />
          <p className="text-xs text-gray-600 mt-1">
            Once set, you can sign in using Email + Password on the portal login page.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Current portal password *</label>
          <input
            type="password"
            autoComplete="current-password"
            {...register('currentPassword', { required: 'Current password is required' })}
            className="w-full px-3 py-2 border border-gray-400 rounded-lg"
          />
          {errors.currentPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg"
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirmNewPassword')}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        {Boolean(newPassword || confirmNewPassword) && newPassword.trim().length > 0 && newPassword.trim().length < 8 && (
          <p className="text-purple-900 text-sm bg-sky-50 border border-purple-200/60 rounded-lg px-3 py-2">
            New passwords must be at least 8 characters.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-purple-700 text-white rounded-lg hover:from-sky-700 hover:to-purple-800 disabled:opacity-50 text-sm font-medium shadow-sm"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

