"use client";

import { useState, useEffect, Suspense } from 'react';
import { Card } from '@/components/Card';
import {
  CheckCircle2, Link as LinkIcon, Plus, Trash2, Edit2, X, Check,
  Globe, MapPin, ExternalLink, ChevronRight, Building2, AlertCircle, Users, UserPlus
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAccount } from '@/context/AccountContext';
import { useSession } from 'next-auth/react';

type Account = {
  id: string;
  name: string;
  googleBusinessUrl?: string | null;
  mainWebsiteUrl?: string | null;
  googleCredential?: any;
  googleAdsConfigs?: any[];
  googleAnalyticsConfigs?: any[];
  googleSearchConsoleConfigs?: any[];
  metaCredential?: any;
  metaAdsConfigs?: any[];
  facebookPageConfigs?: any[];
  instagramPageConfigs?: any[];
};

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'CLIENT';
  status: 'ACTIVE' | 'DISABLED';
  clientMainAccountAccesses?: { mainAccountId: string; mainAccount: { id: string; name: string } }[];
};

// ─── Integration row ──────────────────────────────────────────────────────────
function IntegrationRow({
  icon, label, status, actionLabel, onAction, href, onClear, className = ''
}: {
  icon: React.ReactNode;
  label: string;
  status: React.ReactNode;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 border-b border-border-custom last:border-0 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <div className="text-xs text-muted mt-0.5">{status}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onClear && (
          <button
            onClick={onClear}
            className="flex-shrink-0 p-1.5 text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onAction || (href ? () => { window.location.href = href; } : undefined)}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-accent-custom dark:hover:bg-border-custom dark:text-foreground transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Account list item ────────────────────────────────────────────────────────
function AccountListItem({
  account, isSelected, onClick
}: {
  account: Account;
  isSelected: boolean;
  onClick: () => void;
}) {
  const connectedCount = [
    account.googleCredential,
    (account.googleAdsConfigs?.length ?? 0) > 0,
    (account.googleAnalyticsConfigs?.length ?? 0) > 0,
    (account.googleSearchConsoleConfigs?.length ?? 0) > 0,
    account.mainWebsiteUrl,
    account.googleBusinessUrl,
    account.metaCredential,
    (account.metaAdsConfigs?.length ?? 0) > 0,
    (account.facebookPageConfigs?.length ?? 0) > 0,
    (account.instagramPageConfigs?.length ?? 0) > 0
  ].filter(Boolean).length;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between gap-2 group ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          : 'hover:bg-accent-custom border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          isSelected ? 'bg-blue-600 text-white' : 'bg-accent-custom text-muted group-hover:bg-border-custom'
        }`}>
          {account.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
            {account.name}
          </p>
          <p className="text-[11px] text-muted">
            {connectedCount} service{connectedCount !== 1 ? 's' : ''} connected
          </p>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-blue-500' : 'text-muted opacity-0 group-hover:opacity-100'}`} />
    </button>
  );
}

function SettingsContent() {
  const { accounts, refreshAccounts, selectedAccountId, setSelectedAccountId } = useAccount();
  const { data: session, status } = useSession();

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);
  const [editBusinessUrl, setEditBusinessUrl] = useState('');
  const [editingWebsiteId, setEditingWebsiteId] = useState<string | null>(null);
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pendingUserStatusIds, setPendingUserStatusIds] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CLIENT' as 'ADMIN' | 'CLIENT',
    mainAccountIds: [] as string[],
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) as Account | undefined;
  const selectedWebsiteHref = selectedAccount?.mainWebsiteUrl
    ? (/^https?:\/\//i.test(selectedAccount.mainWebsiteUrl) ? selectedAccount.mainWebsiteUrl : `https://${selectedAccount.mainWebsiteUrl}`)
    : null;

  useEffect(() => {
    if (status !== 'loading' && session?.user?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [router, session?.user?.role, status]);

  useEffect(() => {
    if (success || error) {
      refreshAccounts();
      const timer = setTimeout(() => router.replace('/settings', { scroll: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error, refreshAccounts, router]);

  const refreshUsers = async () => {
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      void refreshUsers();
    }
  }, [session?.user?.role]);

  if (status === 'loading' || session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const createAccount = async () => {
    const name = window.prompt('Enter account name:', 'My Business Account');
    if (!name) return;
    const res = await fetch('/api/accounts', { method: 'POST', body: JSON.stringify({ name }) });
    if (res.ok) {
      const { account } = await res.json();
      await refreshAccounts();
      setSelectedAccountId(account.id);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!window.confirm('Delete this account? All linked integrations will be removed.')) return;
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshAccounts();
      setSelectedAccountId('');
    }
  };

  const saveName = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName })
    });
    if (res.ok) { await refreshAccounts(); setEditingNameId(null); }
  };

  const saveBusinessUrl = async (id: string) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: editBusinessUrl.trim() || null })
    });
    if (res.ok) { await refreshAccounts(); setEditingBusinessId(null); }
  };

  const saveWebsiteUrl = async (id: string) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainWebsiteUrl: editWebsiteUrl.trim() || null })
    });
    if (res.ok) { await refreshAccounts(); setEditingWebsiteId(null); }
  };

  const linkGoogle = (mainAccountId: string) => {
    window.location.href = `/api/auth/google?mainAccountId=${mainAccountId}`;
  };

  const linkMeta = (mainAccountId: string) => {
    window.location.href = `/api/auth/meta?mainAccountId=${mainAccountId}`;
  };

  const disconnectGoogle = async (mainAccountId: string) => {
    if (!window.confirm('Disconnect Google account? This will remove all Google Ads, Analytics, and Search Console configurations for this account.')) return;
    const res = await fetch(`/api/auth/google/disconnect?mainAccountId=${mainAccountId}`, { method: 'POST' });
    if (res.ok) await refreshAccounts();
  };

  const disconnectMeta = async (mainAccountId: string) => {
    if (!window.confirm('Disconnect Meta account? This will remove all Meta Ads, Facebook Pages, and Instagram configurations for this account.')) return;
    const res = await fetch(`/api/auth/meta/disconnect?mainAccountId=${mainAccountId}`, { method: 'POST' });
    if (res.ok) await refreshAccounts();
  };

  const clearIntegration = async (type: string, mainAccountId: string) => {
    if (!window.confirm(`Clear ${type} selection?`)) return;
    const res = await fetch('/api/integrations/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, mainAccountId })
    });
    if (res.ok) await refreshAccounts();
  };

  const toggleNewUserAccount = (mainAccountId: string) => {
    setNewUser((current) => ({
      ...current,
      mainAccountIds: current.mainAccountIds.includes(mainAccountId)
        ? current.mainAccountIds.filter((id) => id !== mainAccountId)
        : [...current.mainAccountIds, mainAccountId],
    }));
  };

  const createUser = async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    if (!res.ok) return;
    setNewUser({ name: '', email: '', password: '', role: 'CLIENT', mainAccountIds: [] });
    await refreshUsers();
  };

  const updateUser = async (id: string, payload: Partial<AppUser> & { mainAccountIds?: string[] }) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshUsers();
  };

  const toggleUserStatus = async (user: AppUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const action = nextStatus === 'DISABLED' ? 'disable' : 'enable';
    if (!window.confirm(`${action === 'disable' ? 'Disable' : 'Enable'} this user?`)) return;

    setPendingUserStatusIds((current) => [...current, user.id]);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) return;
      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, status: nextStatus } : item
      )));
      await refreshUsers();
    } finally {
      setPendingUserStatusIds((current) => current.filter((id) => id !== user.id));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted mt-1">Manage your accounts and integrations.</p>
        </div>
        <button
          onClick={createAccount}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Toast banners */}
      {success === 'google_linked' && <Banner color="emerald" message="Google Ads account successfully linked!" />}
      {success === 'google_analytics_linked' && <Banner color="amber" message="Google Analytics properties successfully linked!" />}
      {success === 'search_console_linked' && <Banner color="violet" message="Search Console sites successfully linked!" />}
      {success === 'meta_linked' && <Banner color="blue" message="Meta account successfully linked!" />}
      {error && <Banner color="red" message="Integration failed. Please try again." />}

      <div className="mb-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-foreground">Users</h2>
          </div>
          <div className="space-y-3">
            {users.map((user) => {
              const assignedIds = user.clientMainAccountAccesses?.map((access) => access.mainAccountId) || [];
              const isStatusPending = pendingUserStatusIds.includes(user.id);
              return (
                <div key={user.id} className="border border-border-custom rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{user.name || user.email}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(event) => updateUser(user.id, { role: event.target.value as AppUser['role'] })}
                        className="text-xs bg-background border border-border-custom rounded-lg px-2 py-1"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="CLIENT">Client</option>
                      </select>
                      <button
                        onClick={() => toggleUserStatus(user)}
                        disabled={isStatusPending}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg disabled:opacity-60 ${
                          user.status === 'ACTIVE'
                            ? 'bg-red-700 text-white dark:bg-red-900/20 dark:text-red-300'
                            : 'bg-emerald-700 text-white dark:bg-emerald-900/20 dark:text-emerald-300'
                        }`}
                      >
                        {isStatusPending ? 'Saving...' : user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                  {user.role === 'CLIENT' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {accounts.map((account) => {
                        const checked = assignedIds.includes(account.id);
                        return (
                          <label key={account.id} className="inline-flex items-center gap-1.5 text-xs text-foreground border border-border-custom rounded-lg px-2 py-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const mainAccountIds = checked
                                  ? assignedIds.filter((id) => id !== account.id)
                                  : [...assignedIds, account.id];
                                updateUser(user.id, { mainAccountIds });
                              }}
                            />
                            {account.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-foreground">Add User</h2>
          </div>
          <div className="space-y-3">
            <input
              value={newUser.name}
              onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
              placeholder="Name"
              className="w-full px-3 py-2 rounded-xl border border-border-custom bg-background text-sm outline-none focus:border-blue-500"
            />
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              placeholder="Email"
              className="w-full px-3 py-2 rounded-xl border border-border-custom bg-background text-sm outline-none focus:border-blue-500"
            />
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
              placeholder="Temporary password"
              className="w-full px-3 py-2 rounded-xl border border-border-custom bg-background text-sm outline-none focus:border-blue-500"
            />
            <select
              value={newUser.role}
              onChange={(event) => setNewUser({ ...newUser, role: event.target.value as 'ADMIN' | 'CLIENT', mainAccountIds: [] })}
              className="w-full px-3 py-2 rounded-xl border border-border-custom bg-background text-sm outline-none focus:border-blue-500"
            >
              <option value="CLIENT">Client</option>
              <option value="ADMIN">Admin</option>
            </select>
            {newUser.role === 'CLIENT' && (
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => (
                  <label key={account.id} className="inline-flex items-center gap-1.5 text-xs text-foreground border border-border-custom rounded-lg px-2 py-1">
                    <input
                      type="checkbox"
                      checked={newUser.mainAccountIds.includes(account.id)}
                      onChange={() => toggleNewUserAccount(account.id)}
                    />
                    {account.name}
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={createUser}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Create User
            </button>
          </div>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-border-custom rounded-2xl bg-card">
          <Building2 className="w-12 h-12 text-muted mx-auto mb-4 opacity-40" />
          <p className="text-muted mb-4">No accounts yet.</p>
          <button
            onClick={createAccount}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Create First Account
          </button>
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* ── Left: account list ─────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 bg-card border border-border-custom rounded-2xl p-2 sticky top-6 max-h-[calc(100vh-140px)] overflow-y-auto">
            <div className="space-y-1">
              {accounts.map(acc => (
                <AccountListItem
                  key={acc.id}
                  account={acc as Account}
                  isSelected={acc.id === selectedAccountId}
                  onClick={() => setSelectedAccountId(acc.id)}
                />
              ))}
            </div>
          </div>

          {/* ── Right: detail panel ────────────────────────────────── */}
          {selectedAccount ? (
            <div className="flex-1 min-w-0 space-y-4">

              {/* Account name card */}
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {selectedAccount.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {editingNameId === selectedAccount.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="text-lg font-bold text-foreground border-b-2 border-blue-600 outline-none bg-transparent py-0.5"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveName(selectedAccount.id);
                              if (e.key === 'Escape') setEditingNameId(null);
                            }}
                          />
                          <button onClick={() => saveName(selectedAccount.id)} className="p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingNameId(null)} className="p-1 text-muted hover:bg-accent-custom rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground truncate">{selectedAccount.name}</h2>
                          <button
                            onClick={() => { setEditingNameId(selectedAccount.id); setEditName(selectedAccount.name); }}
                            className="p-1 text-muted hover:text-blue-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-muted font-mono">{selectedAccount.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingNameId !== selectedAccount.id && (
                      <button
                        onClick={() => { setEditingNameId(selectedAccount.id); setEditName(selectedAccount.name); }}
                        className="p-2 text-muted hover:text-blue-700 hover:bg-blue-100 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteAccount(selectedAccount.id)}
                      className="p-2 text-muted hover:text-red-700 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>

              {/* Integrations card */}
              <Card>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Google Integrations</h3>

                {selectedAccount.googleCredential ? (
                  <>
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-blue-600 dark:bg-blue-900/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-blue-400" /></div>}
                      label="Google Ads"
                      status={(selectedAccount.googleAdsConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.googleAdsConfigs?.length} account(s) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/google-ads/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.googleAdsConfigs?.length ?? 0) > 0 ? () => clearIntegration('google-ads', selectedAccount.id) : undefined}
                    />
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-amber-600 dark:bg-amber-900/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-amber-400" /></div>}
                      label="Google Analytics"
                      status={(selectedAccount.googleAnalyticsConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.googleAnalyticsConfigs?.length} propert(ies) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/google-analytics/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.googleAnalyticsConfigs?.length ?? 0) > 0 ? () => clearIntegration('google-analytics', selectedAccount.id) : undefined}
                    />
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-violet-600 dark:bg-violet-900/30 flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-white dark:text-violet-400" /></div>}
                      label="Search Console"
                      status={(selectedAccount.googleSearchConsoleConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.googleSearchConsoleConfigs?.length} site(s) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/google-search-console/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.googleSearchConsoleConfigs?.length ?? 0) > 0 ? () => clearIntegration('google-search-console', selectedAccount.id) : undefined}
                    />
                    <div className="mt-4 pt-4">
                      <button
                        onClick={() => disconnectGoogle(selectedAccount.id)}
                        className="text-xs font-semibold text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Disconnect Google Account
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-4 flex flex-col items-start gap-3">
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      No Google account linked yet. Link one to enable all integrations.
                    </div>
                    <button
                      onClick={() => linkGoogle(selectedAccount.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" /> Link Google Account
                    </button>
                  </div>
                )}
              </Card>

              {/* Google Business card */}
              <Card>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Google Business Profile</h3>

                {editingBusinessId === selectedAccount.id ? (
                  <div className="flex items-center gap-2 py-3">
                    <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={editBusinessUrl}
                      onChange={e => setEditBusinessUrl(e.target.value)}
                      placeholder="https://business.google.com/..."
                      className="flex-grow text-sm bg-transparent border-b border-orange-400 outline-none py-0.5 text-foreground placeholder:opacity-40"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveBusinessUrl(selectedAccount.id);
                        if (e.key === 'Escape') setEditingBusinessId(null);
                      }}
                    />
                    <button onClick={() => saveBusinessUrl(selectedAccount.id)} className="p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingBusinessId(null)} className="p-1 text-muted hover:bg-accent-custom rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      {selectedAccount.googleBusinessUrl ? (
                        <a
                          href={selectedAccount.googleBusinessUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 truncate"
                        >
                          View Business Profile <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted">Not linked</span>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingBusinessId(selectedAccount.id); setEditBusinessUrl(selectedAccount.googleBusinessUrl || ''); }}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-900/20 dark:text-orange-400 transition-colors"
                    >
                      {selectedAccount.googleBusinessUrl ? 'Edit' : 'Add Link'}
                    </button>
                  </div>
                )}
              </Card>

              {/* Main Website card */}
              <Card>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Main Website</h3>

                {editingWebsiteId === selectedAccount.id ? (
                  <div className="flex items-center gap-2 py-3">
                    <Globe className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={editWebsiteUrl}
                      onChange={e => setEditWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-grow text-sm bg-transparent border-b border-emerald-400 outline-none py-0.5 text-foreground placeholder:opacity-40"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveWebsiteUrl(selectedAccount.id);
                        if (e.key === 'Escape') setEditingWebsiteId(null);
                      }}
                    />
                    <button onClick={() => saveWebsiteUrl(selectedAccount.id)} className="p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingWebsiteId(null)} className="p-1 text-muted hover:bg-accent-custom rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {selectedAccount.mainWebsiteUrl ? (
                        <a
                          href={selectedWebsiteHref || selectedAccount.mainWebsiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
                        >
                          {selectedAccount.mainWebsiteUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted">Not configured</span>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingWebsiteId(selectedAccount.id); setEditWebsiteUrl(selectedAccount.mainWebsiteUrl || ''); }}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
                    >
                      {selectedAccount.mainWebsiteUrl ? 'Edit' : 'Add Website'}
                    </button>
                  </div>
                )}
              </Card>

              {/* Meta Integrations card */}
              <Card>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Meta Integrations</h3>

                {selectedAccount.metaCredential ? (
                  <>
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-blue-600 dark:bg-blue-900/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-blue-400" /></div>}
                      label="Meta Ads"
                      status={(selectedAccount.metaAdsConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.metaAdsConfigs?.length} account(s) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/meta-ads/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.metaAdsConfigs?.length ?? 0) > 0 ? () => clearIntegration('meta-ads', selectedAccount.id) : undefined}
                    />
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-blue-600 dark:bg-blue-900/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-blue-400" /></div>}
                      label="Facebook Pages"
                      status={(selectedAccount.facebookPageConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.facebookPageConfigs?.length} page(s) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/facebook-pages/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.facebookPageConfigs?.length ?? 0) > 0 ? () => clearIntegration('facebook-pages', selectedAccount.id) : undefined}
                    />
                    <IntegrationRow
                      icon={<div className="w-6 h-6 rounded bg-pink-600 dark:bg-pink-900/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-pink-400" /></div>}
                      label="Instagram Pages"
                      status={(selectedAccount.instagramPageConfigs?.length ?? 0) > 0
                        ? <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-transparent dark:px-0 dark:py-0 dark:text-xs dark:text-emerald-400">{selectedAccount.instagramPageConfigs?.length} account(s) connected</span>
                        : 'Not configured'}
                      actionLabel="Configure"
                      href={`/settings/instagram/select?mainAccountId=${selectedAccount.id}`}
                      onClear={(selectedAccount.instagramPageConfigs?.length ?? 0) > 0 ? () => clearIntegration('instagram', selectedAccount.id) : undefined}
                    />
                    <div className="mt-4 pt-4">
                      <button
                        onClick={() => disconnectMeta(selectedAccount.id)}
                        className="text-xs font-semibold text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Disconnect Meta Account
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-4 flex flex-col items-start gap-3">
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <AlertCircle className="w-4 h-4 text-blue-500" />
                      No Meta account linked yet. Link one to enable all integrations.
                    </div>
                    <button
                      onClick={() => linkMeta(selectedAccount.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" /> Link Meta Account
                    </button>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted py-24">
              Select an account to view its integrations.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helper ─────────────────────────────────────────────────────────────
function Banner({ color, message }: { color: string; message: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    amber: 'bg-amber-700 text-white border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    violet: 'bg-violet-700 text-white border-violet-700 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
    red: 'bg-red-700 text-white border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    blue: 'bg-blue-700 text-white border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  };
  return (
    <div className={`mb-6 p-4 border rounded-xl flex items-center gap-3 ${colors[color]}`}>
      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

export default function Settings() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
