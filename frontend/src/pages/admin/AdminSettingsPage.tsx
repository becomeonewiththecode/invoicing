import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { resetAdminPassword } from '../../api/admin';
import { ThemePickerPanel } from '../../components/ThemePickerPanel';
import { useAuthStore } from '../../stores/authStore';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function AdminSettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordForm>();
  const newPassword = watch('newPassword');

  const onSubmit = async (form: PasswordForm) => {
    setLoading(true);
    try {
      await resetAdminPassword(form.currentPassword, form.newPassword);
      toast.success('Password updated successfully');
      reset();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error: string } } }).response?.data?.error
          : 'Failed to update password';
      toast.error(message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>

      <ThemePickerPanel
        description="Color theme for the admin panel, main app, and client portal in this browser."
        className="max-w-2xl mb-8"
      />

      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset Password</h2>
        <p className="text-sm text-gray-500 mb-4">
          Change the password for <span className="font-medium text-gray-700">{user?.email}</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              {...register('currentPassword', { required: 'Current password is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              {...register('newPassword', {
                required: 'New password is required',
                minLength: { value: 8, message: 'Must be at least 8 characters' },
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              {...register('confirmPassword', {
                required: 'Please confirm your new password',
                validate: (value) => value === newPassword || 'Passwords do not match',
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
