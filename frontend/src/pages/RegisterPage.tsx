import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { register as registerApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { getApiErrorMessage } from '../utils/apiError';

interface RegisterForm {
  email: string;
  password: string;
  businessName: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<RegisterForm>();

  const onSubmit = async (form: RegisterForm) => {
    clearErrors();
    setFormError(null);
    setLoading(true);
    try {
      const { user, token } = await registerApi(form.email, form.password, form.businessName);
      setAuth(user, token);
      navigate('/');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Registration failed. Please try again.');
      const lower = msg.toLowerCase();
      if (lower.includes('email')) {
        setError('email', { type: 'server', message: msg });
      } else if (lower.includes('company name')) {
        setError('businessName', { type: 'server', message: msg });
      } else {
        setFormError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-md p-8 bg-surface rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Create Account</h1>
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Business Name</label>
            <input
              type="text"
              {...register('businessName')}
              className="w-full px-3 py-2 border border-input-border rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent"
              aria-invalid={errors.businessName ? 'true' : 'false'}
            />
            {errors.businessName && (
              <p className="text-red-500 text-sm mt-1">{errors.businessName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className="w-full px-3 py-2 border border-input-border rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })}
              className="w-full px-3 py-2 border border-input-border rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-secondary">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
