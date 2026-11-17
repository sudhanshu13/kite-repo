import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AdminUserSummary,
  PortfolioState,
  UserRole,
} from '../../shared/types.ts';
import { apiFetch } from '../utils/api.ts';
import { formatINR } from '../utils/format.ts';
import type { NavTab } from './TopBar.tsx';

interface AdminViewProps {
  currentUserId: string;
  onSyncSelfPortfolio: (portfolio: PortfolioState) => void;
  onNavigate: (tab: NavTab) => void;
  onNotify: (text: string) => void;
}

export function AdminView({
  currentUserId,
  onSyncSelfPortfolio,
  onNavigate,
  onNotify,
}: AdminViewProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [liveFeedActive, setLiveFeedActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Create User Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('123456');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newCapital, setNewCapital] = useState('1000000');
  const [newSeedSamples, setNewSeedSamples] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Manage User Modal
  const [managing, setManaging] = useState<AdminUserSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editDisabled, setEditDisabled] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editPin, setEditPin] = useState('');
  const [capitalDelta, setCapitalDelta] = useState('100000');
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageBusy, setManageBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/admin/users');
      const data = (await res.json()) as {
        users?: AdminUserSummary[];
        liveFeedActive?: boolean;
        error?: string;
      };
      if (!res.ok || !data.users) {
        setError(data.error || 'Failed to load user directory.');
        return;
      }
      setUsers(data.users);
      if (typeof data.liveFeedActive === 'boolean') {
        setLiveFeedActive(data.liveFeedActive);
      }
    } catch {
      setError('Network error while loading admin directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.userId.toLowerCase().includes(q) ||
        u.userName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, query]);

  const stats = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let totalCapital = 0;
    let totalOpenPositions = 0;
    for (const u of users) {
      if (u.disabled) suspended++;
      else active++;
      totalCapital += u.availableCash + u.usedMargin;
      totalOpenPositions += u.openPositionsCount;
    }
    return { total: users.length, active, suspended, totalCapital, totalOpenPositions };
  }, [users]);

  function openManageModal(u: AdminUserSummary) {
    setManaging(u);
    setEditName(u.userName);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditDisabled(u.disabled);
    setEditPassword('');
    setEditPin('');
    setCapitalDelta('100000');
    setManageError(null);
    setConfirmDelete(false);
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUserId.trim().toUpperCase(),
          userName: newName.trim(),
          email: newEmail.trim() || undefined,
          password: newPassword,
          pin: newPin.trim(),
          role: newRole,
          openingBalance: Number(newCapital) || 1000000,
          seedSampleData: newSeedSamples,
        }),
      });
      const data = (await res.json()) as {
        user?: AdminUserSummary;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setCreateError(data.error || 'Could not create user.');
        return;
      }
      setUsers((prev) => [...prev, data.user!]);
      onNotify(`Created ${data.user.role} account ${data.user.userId} (${data.user.userName})`);
      setShowCreate(false);
      setNewUserId('');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewPin('123456');
      setNewRole('user');
      setNewCapital('1000000');
      setNewSeedSamples(false);
    } catch {
      setCreateError('Network error while creating user.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveUserChanges(e: FormEvent) {
    e.preventDefault();
    if (!managing) return;
    setManageError(null);
    setManageBusy(true);
    try {
      const payload: Record<string, unknown> = {
        userName: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        disabled: editDisabled,
      };
      if (editPassword) payload.password = editPassword;
      if (editPin.trim()) payload.pin = editPin.trim();

      const res = await apiFetch(`/api/admin/users/${managing.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { user?: AdminUserSummary; error?: string };
      if (!res.ok || !data.user) {
        setManageError(data.error || 'Failed to update user.');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.userId === data.user!.userId ? data.user! : u)),
      );
      setManaging(data.user);
      setEditPassword('');
      setEditPin('');
      onNotify(`Updated account ${data.user.userId}`);
    } catch {
      setManageError('Network error while updating account.');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleAdjustCapital(sign: 1 | -1) {
    if (!managing) return;
    const raw = Math.abs(Number(capitalDelta));
    if (!Number.isFinite(raw) || raw <= 0) {
      setManageError('Enter a valid positive capital amount.');
      return;
    }
    setManageError(null);
    setManageBusy(true);
    try {
      const res = await apiFetch(`/api/admin/users/${managing.userId}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: sign * raw }),
      });
      const data = (await res.json()) as {
        user?: AdminUserSummary;
        portfolio?: PortfolioState;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setManageError(data.error || 'Failed to adjust virtual capital.');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.userId === data.user!.userId ? data.user! : u)),
      );
      setManaging(data.user);
      if (data.portfolio && data.user.userId === currentUserId) {
        onSyncSelfPortfolio(data.portfolio);
      }
      onNotify(
        `${sign > 0 ? 'Added' : 'Deducted'} ${formatINR(raw)} ${sign > 0 ? 'to' : 'from'} ${data.user.userId}`,
      );
    } catch {
      setManageError('Network error while adjusting capital.');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleResetUserPortfolio() {
    if (!managing) return;
    setManageError(null);
    setManageBusy(true);
    try {
      const res = await apiFetch(`/api/admin/users/${managing.userId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedSampleData: managing.userId === 'KT8492' }),
      });
      const data = (await res.json()) as {
        user?: AdminUserSummary;
        portfolio?: PortfolioState;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setManageError(data.error || 'Failed to reset user portfolio.');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.userId === data.user!.userId ? data.user! : u)),
      );
      setManaging(data.user);
      if (data.portfolio && data.user.userId === currentUserId) {
        onSyncSelfPortfolio(data.portfolio);
      }
      onNotify(`Reset portfolio for ${data.user.userId} to ₹10,00,000`);
    } catch {
      setManageError('Network error while resetting portfolio.');
    } finally {
      setManageBusy(false);
    }
  }

  async function handleToggleSuspend(u: AdminUserSummary) {
    const res = await apiFetch(`/api/admin/users/${u.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !u.disabled }),
    });
    const data = (await res.json()) as { user?: AdminUserSummary; error?: string };
    if (!res.ok || !data.user) {
      onNotify(data.error || 'Could not update status.');
      return;
    }
    setUsers((prev) =>
      prev.map((item) => (item.userId === data.user!.userId ? data.user! : item)),
    );
    onNotify(
      `${data.user.userId} ${data.user.disabled ? 'suspended' : 'activated'}`,
    );
  }

  async function handleDeleteUser() {
    if (!managing) return;
    setManageError(null);
    setManageBusy(true);
    try {
      const res = await apiFetch(`/api/admin/users/${managing.userId}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setManageError(data.error || 'Could not delete user.');
        return;
      }
      const deletedId = managing.userId;
      setUsers((prev) => prev.filter((u) => u.userId !== deletedId));
      setManaging(null);
      onNotify(`Deleted user ${deletedId}`);
    } catch {
      setManageError('Network error while deleting user.');
    } finally {
      setManageBusy(false);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            Admin · User &amp; Capital Management
          </h1>
          <p className="text-xs text-[#9B9B9B] mt-0.5">
            Create trader accounts, allocate virtual margin, and manage access controls
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onNavigate('funds')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E0E0E0] dark:border-[#333333] text-[#444444] dark:text-[#E0E0E0] hover:border-[#4184F3] hover:text-[#4184F3] rounded transition-colors cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Funds &amp; API Settings</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-3 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <div className="text-xs text-[#9B9B9B]">Total accounts</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {stats.total}{' '}
            <span className="text-xs text-[#4CAF50] dark:text-[#4ADE80]">
              ({stats.active} active)
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Suspended</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {stats.suspended}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Managed paper capital</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {formatINR(stats.totalCapital)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Open positions · Feed</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {stats.totalOpenPositions}{' '}
            <span className="text-xs text-[#9B9B9B]">
              · {liveFeedActive ? 'Live NSE/BSE' : 'Fallback'}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Client ID, name, or email..."
            aria-label="Search users"
            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
          />
        </div>

        <button
          type="button"
          onClick={loadUsers}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#666666] dark:text-[#A0A0A0] hover:text-[#4184F3] cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh directory</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2 text-xs text-[#DF514C] bg-[#DF514C]/10 border border-[#DF514C]/30 rounded"
        >
          {error}
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="py-10 text-xs text-[#9B9B9B]">Loading user directory...</div>
      ) : (
        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                <th className="py-2.5 px-3 font-normal">Client ID</th>
                <th className="py-2.5 px-3 font-normal">Trader</th>
                <th className="py-2.5 px-3 font-normal">Role</th>
                <th className="py-2.5 px-3 font-normal">Status</th>
                <th className="py-2.5 px-3 font-normal text-right">Available Cash</th>
                <th className="py-2.5 px-3 font-normal text-right">Used Margin</th>
                <th className="py-2.5 px-3 font-normal text-right">Pos. / Hold.</th>
                <th className="py-2.5 px-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {filteredUsers.map((u) => {
                const isSelf = u.userId === currentUserId;
                return (
                  <tr
                    key={u.userId}
                    className={`hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors ${
                      u.disabled ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-medium tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {u.userId}
                      {isSelf && (
                        <span className="ml-1.5 text-[10px] text-[#9B9B9B] font-normal">
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[#444444] dark:text-[#E0E0E0]">{u.userName}</div>
                      <div className="text-[11px] text-[#9B9B9B]">{u.email}</div>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span
                        className={
                          u.role === 'admin'
                            ? 'text-[#FF5722] font-semibold uppercase text-[11px]'
                            : 'text-[#666666] dark:text-[#A0A0A0] uppercase text-[11px]'
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span
                        className={
                          u.disabled
                            ? 'text-[#DF514C] dark:text-[#F87171] font-medium'
                            : 'text-[#4CAF50] dark:text-[#4ADE80] font-medium'
                        }
                      >
                        {u.disabled ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatINR(u.availableCash)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      {formatINR(u.usedMargin)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs text-[#666666] dark:text-[#A0A0A0]">
                      {u.openPositionsCount} / {u.holdingsCount}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openManageModal(u)}
                          aria-label={`Manage ${u.userId}`}
                          className="px-2.5 py-1 text-[11px] font-medium border border-[#4184F3] text-[#4184F3] hover:bg-[#4184F3]/10 rounded cursor-pointer"
                        >
                          Manage
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(u)}
                            aria-label={
                              u.disabled ? `Activate ${u.userId}` : `Suspend ${u.userId}`
                            }
                            title={u.disabled ? 'Activate user' : 'Suspend user'}
                            className={`p-1.5 rounded border text-xs cursor-pointer ${
                              u.disabled
                                ? 'border-[#4CAF50] text-[#4CAF50] hover:bg-[#4CAF50]/10'
                                : 'border-[#E0E0E0] dark:border-[#333333] text-[#9B9B9B] hover:border-[#DF514C] hover:text-[#DF514C]'
                            }`}
                          >
                            {u.disabled ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FF5722] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <h2 id="create-user-title" className="text-sm font-semibold">
                  Create New User Account
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Close create user modal"
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              {createError && (
                <div
                  role="alert"
                  className="px-3 py-2 text-xs text-[#DF514C] bg-[#DF514C]/10 border border-[#DF514C]/30 rounded"
                >
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-new-id"
                    className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                  >
                    Client ID
                  </label>
                  <input
                    id="admin-new-id"
                    type="text"
                    required
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value.toUpperCase())}
                    placeholder="KT9012"
                    className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-new-role"
                    className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="admin-new-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  >
                    <option value="user">Trader (User)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-new-name"
                  className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Full Name
                </label>
                <input
                  id="admin-new-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Rohan Kulkarni"
                  className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-email"
                  className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Email (Optional)
                </label>
                <input
                  id="admin-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="rohan@kitesandbox.local"
                  className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-new-password"
                    className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="admin-new-password"
                    type="password"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-new-pin"
                    className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                  >
                    6-Digit PIN
                  </label>
                  <input
                    id="admin-new-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-new-capital"
                  className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Opening Virtual Capital (₹)
                </label>
                <input
                  id="admin-new-capital"
                  type="number"
                  min={10000}
                  max={50000000}
                  required
                  value={newCapital}
                  onChange={(e) => setNewCapital(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] tabular-nums"
                />
              </div>

              <label className="flex items-center gap-2 text-[#666666] dark:text-[#A0A0A0] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newSeedSamples}
                  onChange={(e) => setNewSeedSamples(e.target.checked)}
                  className="rounded border-[#E0E0E0] dark:border-[#333333]"
                />
                <span>Seed sample holdings &amp; intraday positions</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEEEEE] dark:border-[#282828]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#E0E0E0] dark:border-[#333333] rounded text-[#666666] dark:text-[#A0A0A0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#FF5722] hover:bg-[#E64A19] disabled:opacity-50 text-white rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creating ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage User Modal */}
      {managing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-user-title"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-3.5 bg-[#4184F3] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <h2 id="manage-user-title" className="text-sm font-semibold">
                  Manage {managing.userId} · {managing.userName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setManaging(null)}
                aria-label="Close manage user modal"
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {manageError && (
                <div
                  role="alert"
                  className="px-3 py-2 text-xs text-[#DF514C] bg-[#DF514C]/10 border border-[#DF514C]/30 rounded"
                >
                  {manageError}
                </div>
              )}

              {/* Capital & Portfolio Controls */}
              <div className="p-3.5 bg-[#F9F9F9] dark:bg-[#121212] border border-[#EEEEEE] dark:border-[#282828] rounded space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                    Virtual Margin Control
                  </span>
                  <span className="tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                    Available: <strong>{formatINR(managing.availableCash)}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10000000}
                    value={capitalDelta}
                    onChange={(e) => setCapitalDelta(e.target.value)}
                    aria-label="Virtual capital adjustment amount"
                    className="flex-1 min-w-[120px] px-3 py-1.5 tabular-nums bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  />
                  <button
                    type="button"
                    disabled={manageBusy}
                    onClick={() => handleAdjustCapital(1)}
                    className="px-3 py-1.5 font-semibold bg-[#4CAF50] hover:bg-[#43A047] text-white rounded cursor-pointer disabled:opacity-50"
                  >
                    + Add Capital
                  </button>
                  <button
                    type="button"
                    disabled={manageBusy}
                    onClick={() => handleAdjustCapital(-1)}
                    className="px-3 py-1.5 font-semibold border border-[#E0E0E0] dark:border-[#333333] text-[#444444] dark:text-[#E0E0E0] hover:border-[#DF514C] hover:text-[#DF514C] rounded cursor-pointer disabled:opacity-50"
                  >
                    − Deduct
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EEEEEE] dark:border-[#282828]">
                  <span className="text-[11px] text-[#9B9B9B] tabular-nums">
                    Used: {formatINR(managing.usedMargin)} · Open pos: {managing.openPositionsCount}
                  </span>
                  <button
                    type="button"
                    disabled={manageBusy}
                    onClick={handleResetUserPortfolio}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4184F3] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset Portfolio</span>
                  </button>
                </div>
              </div>

              {/* Profile, Role & Credentials */}
              <form onSubmit={handleSaveUserChanges} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="manage-name"
                      className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="manage-name"
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manage-email"
                      className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      Email
                    </label>
                    <input
                      id="manage-email"
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="manage-role"
                      className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      Role
                    </label>
                    <select
                      id="manage-role"
                      value={editRole}
                      disabled={managing.userId === currentUserId}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] disabled:opacity-60"
                    >
                      <option value="user">Trader (User)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="manage-status"
                      className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      Account Status
                    </label>
                    <select
                      id="manage-status"
                      value={editDisabled ? 'suspended' : 'active'}
                      disabled={managing.userId === currentUserId}
                      onChange={(e) => setEditDisabled(e.target.value === 'suspended')}
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] disabled:opacity-60"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="manage-password"
                      className="flex items-center gap-1 text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Reset Password (Optional)</span>
                    </label>
                    <input
                      id="manage-password"
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep"
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manage-pin"
                      className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                    >
                      Reset 6-Digit PIN (Optional)
                    </label>
                    <input
                      id="manage-pin"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={editPin}
                      onChange={(e) =>
                        setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="Leave blank to keep"
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#EEEEEE] dark:border-[#282828]">
                  {managing.userId !== currentUserId ? (
                    confirmDelete ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={manageBusy}
                          onClick={handleDeleteUser}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-[#DF514C] text-white rounded cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="text-[11px] text-[#9B9B9B] hover:underline cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#DF514C] hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account</span>
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-[#9B9B9B]">Active Admin Session</span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManaging(null)}
                      className="px-4 py-2 font-medium border border-[#E0E0E0] dark:border-[#333333] rounded text-[#666666] dark:text-[#A0A0A0] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={manageBusy}
                      className="px-4 py-2 font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded cursor-pointer disabled:opacity-50"
                    >
                      {manageBusy ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
