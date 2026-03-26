import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { portalLogin } from '../../api/portal';
import { usePortalAuthStore } from '../../stores/portalAuthStore';

interface Form {
  accessToken: string;
  password: string;
  totpCode: string;
}

export function PortalLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = usePortalAuthStore((s) => s.token);
  const setPortalAuth = usePortalAuthStore((s) => s.setPortalAuth);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    defaultValues: { accessToken: '', password: '', totpCode: '' },
  });

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setValue('accessToken', t);
  }, [searchParams, setValue]);

  if (token) {
    return <Navigate to="/portal" replace />;
  }

  const onSubmit = async (form: Form) => {
    setLoading(true);
    try {
      const res = await portalLogin({
        accessToken: form.accessToken.trim(),
        password: form.password.trim(),
        totpCode: form.totpCode.trim() || undefined,
      });
      if ('requiresTwoFactor' in res && res.requiresTwoFactor) {
        setNeeds2fa(true);
        toast('Enter the code from your authenticator app', { icon: '🔐' });
        setLoading(false);
        return;
      }
      if ('token' in res) {
        setPortalAuth(res.token, {
          client: res.client,
          vendor: res.vendor,
          portal: res.portal,
        });
        toast.success('Signed in');
        navigate('/portal', { replace: true });
        return;
      }
      toast.error('Unexpected response');
    } catch (err: unknown) {
      // Show backend-provided reason (e.g. portal disabled / password not set / invalid 2FA)
      const data = err as { response?: { data?: { error?: string; message?: string } } };
      const msg = data.response?.data?.error ?? data.response?.data?.message;
      toast.error(msg ?? 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Client portal</h1>
        <p className="text-sm text-gray-600 mb-6">
          Use the access link and password from your vendor.{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Vendor sign in
          </Link>
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access token</label>
            <input
              type="text"
              autoComplete="off"
              {...register('accessToken', { required: 'Access token is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="From your vendor’s portal link"
            />
            {errors.accessToken && (
              <p className="text-red-500 text-sm mt-1">{errors.accessToken.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Portal password</label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password', { required: 'Password is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>
          {needs2fa && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register('totpCode', { required: needs2fa ? 'Enter the 6-digit code' : false })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg tracking-widest"
                placeholder="6-digit code"
              />
              {errors.totpCode && (
                <p className="text-red-500 text-sm mt-1">{errors.totpCode.message}</p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
