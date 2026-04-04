import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { portalLogin } from '../../api/portal';
import { usePortalAuthStore } from '../../stores/portalAuthStore';
import { getApiErrorMessage } from '../../utils/apiError';

interface Form {
  email: string;
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
  const [useEmailLogin, setUseEmailLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    defaultValues: { email: '', accessToken: '', password: '', totpCode: '' },
  });

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setValue('accessToken', t);
  }, [searchParams, setValue]);

  if (token) {
    return <Navigate to="/portal" replace />;
  }

  const onSubmit = async (form: Form) => {
    setFormError(null);
    setLoading(true);
    try {
      const res = await portalLogin({
        accessToken: useEmailLogin ? undefined : form.accessToken.trim(),
        email: useEmailLogin ? form.email.trim() : undefined,
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
      setFormError('Unexpected response from server.');
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, 'Could not sign in. Check your access details and password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100/80 via-blue-50 to-purple-100/60 p-4">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-sky-200/70">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Client portal</h1>
        <p className="text-sm text-gray-700 mb-6">
          Use the access link and password from your vendor.{' '}
          <Link to="/login" className="text-purple-700 hover:text-purple-800 hover:underline">
            Vendor sign in
          </Link>
        </p>
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {formError}
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setUseEmailLogin(false);
              setFormError(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              !useEmailLogin
                ? 'bg-sky-100 text-purple-900 border-sky-300'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-sky-50/50'
            }`}
          >
            Access token
          </button>
          <button
            type="button"
            onClick={() => {
              setUseEmailLogin(true);
              setFormError(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              useEmailLogin
                ? 'bg-sky-100 text-purple-900 border-sky-300'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-sky-50/50'
            }`}
          >
            Email
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {useEmailLogin ? (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Access token</label>
              <input
                type="text"
                autoComplete="off"
                {...register('accessToken', { required: 'Access token is required' })}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg font-mono text-sm"
                placeholder="From your vendor’s portal link"
              />
              {errors.accessToken && (
                <p className="text-red-500 text-sm mt-1">{errors.accessToken.message}</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Portal password</label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password', { required: 'Password is required' })}
              className="w-full px-3 py-2 border border-gray-400 rounded-lg"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>
          {needs2fa && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register('totpCode', { required: needs2fa ? 'Enter the 6-digit code' : false })}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg tracking-widest"
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
            className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-purple-700 text-white rounded-lg hover:from-sky-700 hover:to-purple-800 disabled:opacity-50 transition-colors font-medium shadow-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
