import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, updateSettings, uploadLogo, deleteLogo } from '../api/settings';
import { useAuthStore } from '../stores/authStore';
import { resolveApiAssetUrl } from '../utils/resolveApiUrl';

interface SettingsForm {
  businessName: string;
  defaultTaxRate: number;
  businessPhone: string;
  businessWebsite: string;
  businessAddress: string;
  taxId: string;
  defaultHourlyRate: string;
  businessFax: string;
  logoUrl: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isPending } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { register, handleSubmit, reset, getValues, formState: { errors } } = useForm<SettingsForm>({
    defaultValues: {
      businessName: '',
      defaultTaxRate: 0,
      businessPhone: '',
      businessWebsite: '',
      businessAddress: '',
      taxId: '',
      defaultHourlyRate: '',
      businessFax: '',
      logoUrl: '',
    },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      businessName: settings.businessName ?? '',
      defaultTaxRate: settings.defaultTaxRate ?? 0,
      businessPhone: settings.businessPhone ?? '',
      businessWebsite: settings.businessWebsite ?? '',
      businessAddress: settings.businessAddress ?? '',
      taxId: settings.taxId ?? '',
      defaultHourlyRate:
        settings.defaultHourlyRate != null ? String(settings.defaultHourlyRate) : '',
      businessFax: settings.businessFax ?? '',
      logoUrl: settings.logoUrl ?? '',
    });
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      if (user && token) {
        setAuth(
          { ...user, businessName: saved.businessName ?? undefined },
          token
        );
      }
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      reset({ ...getValues(), logoUrl: saved.logoUrl ?? '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Logo uploaded');
    },
    onError: (e: Error) => toast.error(e.message || 'Upload failed'),
  });

  const deleteLogoMutation = useMutation({
    mutationFn: deleteLogo,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      reset({ ...getValues(), logoUrl: saved.logoUrl ?? '' });
      toast.success('Logo removed');
    },
    onError: () => toast.error('Failed to remove logo'),
  });

  const onSubmit = (data: SettingsForm) => {
    const hourly = data.defaultHourlyRate.trim();
    mutation.mutate({
      businessName: data.businessName.trim(),
      defaultTaxRate: Number(data.defaultTaxRate),
      businessPhone: data.businessPhone.trim(),
      businessWebsite: data.businessWebsite.trim(),
      businessAddress: data.businessAddress.trim() || undefined,
      taxId: data.taxId.trim() || undefined,
      defaultHourlyRate: hourly === '' ? null : Number(hourly),
      businessFax: data.businessFax.trim() || undefined,
      logoUrl: data.logoUrl.trim() || undefined,
    });
  };

  if (isPending && !settings) {
    return <div className="text-center py-8 text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-gray-600 text-sm mb-6">
        Company name, tax rate, phone, and website are required and appear on invoices. Tax rate is the default
        percentage applied to new invoices (before discounts).
      </p>

      <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Discount codes</h2>
        <p className="text-sm text-gray-600 mt-1">
          Create reusable codes (percent or fixed amount), then assign them to clients so discounts apply on invoices.
        </p>
        <Link
          to="/discounts"
          className="inline-flex mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Manage discount codes →
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Required</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
              <input
                {...register('businessName', { required: 'Company name is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Your company legal name"
              />
              {errors.businessName && (
                <p className="text-red-500 text-sm mt-1">{errors.businessName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default tax rate (%) *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...register('defaultTaxRate', { required: true, valueAsNumber: true, min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Applied to taxable amount on new invoices (multiplied as a percentage).
              </p>
              {errors.defaultTaxRate && (
                <p className="text-red-500 text-sm mt-1">Enter a tax rate between 0 and 100</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number *</label>
              <input
                {...register('businessPhone', { required: 'Phone number is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="+1 …"
              />
              {errors.businessPhone && (
                <p className="text-red-500 text-sm mt-1">{errors.businessPhone.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website *</label>
              <input
                {...register('businessWebsite', { required: 'Website is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="https://example.com"
              />
              {errors.businessWebsite && (
                <p className="text-red-500 text-sm mt-1">{errors.businessWebsite.message}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Optional</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default hourly rate</label>
              <input
                type="number"
                step="0.01"
                min={0}
                {...register('defaultHourlyRate')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Used as default unit price for new line items"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HST / tax ID number</label>
              <input {...register('taxId')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company address</label>
              <textarea
                {...register('businessAddress')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fax number</label>
              <input {...register('businessFax')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company logo</label>
              <p className="text-xs text-gray-500 mb-3">
                Upload an image (JPEG, PNG, WebP, or GIF, max 2&nbsp;MB). It appears on generated PDF invoices.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                }}
              />
              {settings?.logoUrl && (
                <div className="mb-3 flex items-start gap-4">
                  <div className="h-20 w-40 shrink-0 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                    <img
                      src={resolveApiAssetUrl(settings.logoUrl)}
                      alt="Company logo preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMutation.isPending || deleteLogoMutation.isPending}
                      className="text-left text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {uploadMutation.isPending ? 'Uploading…' : 'Replace image…'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLogoMutation.mutate()}
                      disabled={uploadMutation.isPending || deleteLogoMutation.isPending}
                      className="text-left text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleteLogoMutation.isPending ? 'Removing…' : 'Remove logo'}
                    </button>
                  </div>
                </div>
              )}
              {!settings?.logoUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="mb-3 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload image…'}
                </button>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">Or logo URL</label>
              <input
                {...register('logoUrl')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="https://… (optional; use upload above for best PDF compatibility)"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
