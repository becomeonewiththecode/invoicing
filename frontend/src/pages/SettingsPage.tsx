import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, updateSettings, uploadLogo, deleteLogo, getSmtpSettings, updateSmtpSettings, sendSmtpTest } from '../api/settings';
import type { SmtpSettings } from '../api/settings';
import { downloadAccountBackup, importAccountBackup } from '../api/data';
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
  businessEmail: string;
  logoUrl: string;
}

type SettingsTab = 'general' | 'discounts' | 'email' | 'backup';

const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'email', label: 'Email' },
  { key: 'backup', label: 'Backup' },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importBackupInputRef = useRef<HTMLInputElement>(null);
  const [importReplaceConfirmed, setImportReplaceConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      businessEmail: '',
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
      businessEmail: settings.businessEmail ?? '',
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

  const exportMutation = useMutation({
    mutationFn: downloadAccountBackup,
    onSuccess: () => toast.success('Backup downloaded'),
    onError: () => toast.error('Export failed'),
  });

  const importMutation = useMutation({
    mutationFn: importAccountBackup,
    onSuccess: () => {
      setImportReplaceConfirmed(false);
      if (importBackupInputRef.current) importBackupInputRef.current.value = '';
      queryClient.invalidateQueries();
      toast.success('Backup imported. Your account data was replaced.');
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : undefined;
      toast.error(msg || (err instanceof Error ? err.message : 'Import failed'));
    },
  });

  // --- SMTP settings ---
  const smtpQuery = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: getSmtpSettings,
  });

  const {
    register: registerSmtp,
    handleSubmit: handleSmtpSubmit,
    reset: resetSmtp,
    formState: { errors: smtpErrors },
  } = useForm<SmtpSettings>({
    defaultValues: { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' },
  });

  useEffect(() => {
    if (!smtpQuery.data) return;
    resetSmtp(smtpQuery.data);
  }, [smtpQuery.data, resetSmtp]);

  const smtpMutation = useMutation({
    mutationFn: updateSmtpSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] });
      toast.success('SMTP settings saved');
    },
    onError: () => toast.error('Failed to save SMTP settings'),
  });

  const smtpTestMutation = useMutation({
    mutationFn: sendSmtpTest,
    onSuccess: (data) => setSmtpTestResult({ type: 'success', message: data.message }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : undefined;
      setSmtpTestResult({ type: 'error', message: msg || 'SMTP test failed' });
    },
  });

  const onSmtpSubmit = (data: SmtpSettings) => {
    smtpMutation.mutate({
      smtpHost: data.smtpHost.trim(),
      smtpPort: Number(data.smtpPort) || 587,
      smtpUser: data.smtpUser.trim(),
      smtpPass: data.smtpPass,
    });
  };

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
      businessEmail: data.businessEmail.trim() || undefined,
      logoUrl: data.logoUrl.trim() || undefined,
    });
  };

  if (isPending && !settings) {
    return <div className="text-center py-8 text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <>
          <p className="text-gray-600 text-sm mb-6">
            Company name, tax rate, phone, and website are required and appear on invoices. Tax rate is the default
            percentage applied to new invoices (before discounts).
          </p>

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
        </>
      )}

      {/* Discounts tab */}
      {activeTab === 'discounts' && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Discount codes</h2>
          <p className="text-sm text-gray-600 mb-6">
            Create reusable codes (percent or fixed amount), then assign them to clients so discounts apply on invoices.
          </p>
          <Link
            to="/discounts"
            className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Manage discount codes
          </Link>
        </div>
      )}

      {/* Email tab */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">SMTP configuration</h2>
          <p className="text-sm text-gray-600 mb-6">
            Required for emailing invoices. Server environment variables are used as a fallback if these fields are empty.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
              Example: SendGrid
            </summary>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 space-y-1">
              <p><span className="font-medium text-gray-900">Host:</span> smtp.sendgrid.net</p>
              <p><span className="font-medium text-gray-900">Port:</span> 587</p>
              <p><span className="font-medium text-gray-900">User:</span> apikey</p>
              <p><span className="font-medium text-gray-900">Password:</span> your SendGrid API key (starts with <code className="text-xs bg-gray-100 px-1 rounded">SG.</code>)</p>
              <p className="text-xs text-gray-500 mt-2">
                Create an API key at SendGrid &rarr; Settings &rarr; API Keys with &quot;Mail Send&quot; permission.
                The username is always the literal string <code className="bg-gray-100 px-1 rounded">apikey</code>.
              </p>
            </div>
          </details>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
              Example: Gmail
            </summary>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 space-y-1">
              <p><span className="font-medium text-gray-900">Host:</span> smtp.gmail.com</p>
              <p><span className="font-medium text-gray-900">Port:</span> 587</p>
              <p><span className="font-medium text-gray-900">User:</span> your full Gmail address</p>
              <p><span className="font-medium text-gray-900">Password:</span> a Google App Password (not your Gmail password)</p>
              <p className="text-xs text-gray-500 mt-2">
                Requires 2-Step Verification enabled. Generate an App Password at Google Account &rarr; Security &rarr; App passwords.
              </p>
            </div>
          </details>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
              Example: Outlook / Microsoft 365
            </summary>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 space-y-1">
              <p><span className="font-medium text-gray-900">Host:</span> smtp.office365.com</p>
              <p><span className="font-medium text-gray-900">Port:</span> 587</p>
              <p><span className="font-medium text-gray-900">User:</span> your full Outlook / M365 email</p>
              <p><span className="font-medium text-gray-900">Password:</span> your account password or app password</p>
            </div>
          </details>
          <form onSubmit={handleSmtpSubmit(onSmtpSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP host</label>
                <input
                  {...registerSmtp('smtpHost')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP port</label>
                <input
                  type="number"
                  {...registerSmtp('smtpPort', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="587"
                />
                <p className="text-xs text-gray-500 mt-1">587 (STARTTLS) or 465 (SSL)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP user</label>
                <input
                  {...registerSmtp('smtpUser')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="user@example.com"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP password</label>
                <input
                  type="password"
                  {...registerSmtp('smtpPass')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="App password or SMTP password"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {smtpQuery.data?.smtpHost?.trim() && (
                <button
                  type="button"
                  onClick={() => smtpTestMutation.mutate()}
                  disabled={smtpTestMutation.isPending}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {smtpTestMutation.isPending ? 'Sending…' : 'Send test email'}
                </button>
              )}
              <button
                type="submit"
                disabled={smtpMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {smtpMutation.isPending ? 'Saving…' : 'Save SMTP'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Company email (invoice copies)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Where to send &quot;email invoice to company&quot; — leave blank to use your login email.
              Used when you email an invoice copy to yourself from an invoice.
            </p>
            <input
              type="email"
              {...register('businessEmail')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="company@example.com"
            />
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => {
                  const vals = getValues();
                  const hourly = vals.defaultHourlyRate.trim();
                  mutation.mutate({
                    businessName: vals.businessName.trim(),
                    defaultTaxRate: Number(vals.defaultTaxRate),
                    businessPhone: vals.businessPhone.trim(),
                    businessWebsite: vals.businessWebsite.trim(),
                    businessAddress: vals.businessAddress.trim() || undefined,
                    taxId: vals.taxId.trim() || undefined,
                    defaultHourlyRate: hourly === '' ? null : Number(hourly),
                    businessFax: vals.businessFax.trim() || undefined,
                    businessEmail: vals.businessEmail.trim() || undefined,
                    logoUrl: vals.logoUrl.trim() || undefined,
                  });
                }}
                disabled={mutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving…' : 'Save email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup tab */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Data backup</h2>
          <p className="text-sm text-gray-600 mb-6">
            Download a JSON file with your profile, clients, discount codes, and invoices. You can restore it later on this
            or another account — importing replaces all of that data for the current user.
          </p>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Export</h3>
            <button
              type="button"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
            >
              {exportMutation.isPending ? 'Preparing…' : 'Download backup'}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Import from backup</h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose a <code className="text-xs bg-gray-200 px-1 rounded">.json</code> file from &quot;Download backup&quot;
              above. This deletes your current clients, invoices, and discounts for this account and replaces them with the
              file contents. Your login email and password are unchanged.
            </p>
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={importReplaceConfirmed}
                onChange={(e) => setImportReplaceConfirmed(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                I understand this permanently replaces my current business data with the backup.
              </span>
            </label>
            <input
              ref={importBackupInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !importReplaceConfirmed) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const parsed = JSON.parse(String(reader.result));
                    importMutation.mutate(parsed);
                  } catch {
                    toast.error('Invalid JSON file');
                  }
                };
                reader.readAsText(f);
              }}
            />
            <button
              type="button"
              disabled={!importReplaceConfirmed || importMutation.isPending}
              onClick={() => importBackupInputRef.current?.click()}
              className="mt-3 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? 'Importing…' : 'Choose backup file…'}
            </button>
          </div>
        </div>
      )}

      {/* SMTP test result modal */}
      {smtpTestResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSmtpTestResult(null)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {smtpTestResult.type === 'success' ? (
                <div className="shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {smtpTestResult.type === 'success' ? 'Test email sent' : 'Test email failed'}
                </h3>
                <p className="mt-1 text-sm text-gray-600 break-words">{smtpTestResult.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSmtpTestResult(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
