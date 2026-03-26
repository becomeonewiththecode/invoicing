import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getPortalMe,
  portal2faDisable,
  portal2faEnable,
  portal2faSetup,
} from '../../api/portal';
import { usePortalAuthStore } from '../../stores/portalAuthStore';

interface EnableForm {
  code: string;
}

interface DisableForm {
  password: string;
}

export function PortalSecurityPage() {
  const queryClient = useQueryClient();
  const setPortalAuth = usePortalAuthStore((s) => s.setPortalAuth);
  const token = usePortalAuthStore((s) => s.token);
  const session = usePortalAuthStore((s) => s.session);

  const meQuery = useQuery({
    queryKey: ['portal-me'],
    queryFn: getPortalMe,
  });

  const [setup, setSetup] = useState<{
    qrDataUrl: string;
    otpauthUrl: string;
    secret: string;
  } | null>(null);

  const setupMutation = useMutation({
    mutationFn: portal2faSetup,
    onSuccess: (data) => {
      setSetup(data);
      toast.success('Scan the QR code or enter the secret in your app');
    },
    onError: () => toast.error('Could not start two-factor setup'),
  });

  const enableForm = useForm<EnableForm>();
  const disableForm = useForm<DisableForm>();

  const enableMutation = useMutation({
    mutationFn: (code: string) => portal2faEnable(code),
    onSuccess: async () => {
      toast.success('Two-factor authentication is on');
      setSetup(null);
      await queryClient.invalidateQueries({ queryKey: ['portal-me'] });
      const m = await getPortalMe();
      if (token) {
        setPortalAuth(token, {
          client: m.client,
          vendor: m.vendor,
          portal: m.portal,
        });
      }
    },
    onError: () => toast.error('Invalid code'),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => portal2faDisable(password),
    onSuccess: async () => {
      toast.success('Two-factor authentication is off');
      await queryClient.invalidateQueries({ queryKey: ['portal-me'] });
      const m = await getPortalMe();
      if (token) {
        setPortalAuth(token, {
          client: m.client,
          vendor: m.vendor,
          portal: m.portal,
        });
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Could not disable 2FA');
    },
  });

  const twoFactorEnabled =
    meQuery.data?.portal.twoFactorEnabled ?? session?.portal.twoFactorEnabled ?? false;

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Add an authenticator app for a second step when you sign in to the client portal.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Two-factor authentication</h2>
        <p className="text-sm text-gray-600 mt-2">
          Status:{' '}
          <span className={twoFactorEnabled ? 'text-green-700 font-medium' : 'text-gray-700'}>
            {twoFactorEnabled ? 'Enabled' : 'Off'}
          </span>
        </p>

        {!twoFactorEnabled && (
          <div className="mt-4 space-y-4">
            {!setup && (
              <button
                type="button"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {setupMutation.isPending ? 'Preparing…' : 'Set up authenticator'}
              </button>
            )}
            {setup && (
              <>
                <div className="flex flex-col items-center gap-2">
                  <img src={setup.qrDataUrl} alt="QR code for authenticator" className="rounded-lg border" />
                  <p className="text-xs text-gray-500 break-all text-center">{setup.otpauthUrl}</p>
                </div>
                <form
                  onSubmit={enableForm.handleSubmit((f) => enableMutation.mutate(f.code.trim()))}
                  className="space-y-2"
                >
                  <label className="block text-sm font-medium text-gray-700">Verification code</label>
                  <input
                    {...enableForm.register('code', { required: 'Enter the 6-digit code' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg tracking-widest"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                  />
                  {enableForm.formState.errors.code && (
                    <p className="text-red-500 text-sm">{enableForm.formState.errors.code.message}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={enableMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      {enableMutation.isPending ? 'Verifying…' : 'Enable 2FA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetup(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {twoFactorEnabled && (
          <form
            onSubmit={disableForm.handleSubmit((f) => disableMutation.mutate(f.password))}
            className="mt-4 space-y-3"
          >
            <p className="text-sm text-gray-600">Enter your portal password to turn off 2FA.</p>
            <input
              type="password"
              {...disableForm.register('password', { required: 'Password required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              autoComplete="current-password"
            />
            {disableForm.formState.errors.password && (
              <p className="text-red-500 text-sm">{disableForm.formState.errors.password.message}</p>
            )}
            <button
              type="submit"
              disabled={disableMutation.isPending}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
