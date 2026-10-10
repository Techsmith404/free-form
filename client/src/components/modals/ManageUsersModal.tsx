import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Invite, User } from '../../types/index.js';
import { fetchInvites, createInvite, deleteInvite, fetchUsers } from '../../api/index.js';
import { X, Key, UserCheck, Plus, Trash2, Copy, Check, Clock, ShieldAlert } from 'lucide-react';

interface ManageUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageUsersModal: React.FC<ManageUsersModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'invites' | 'users'>('invites');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New invite form state
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const [invList, userList] = await Promise.all([
        fetchInvites().catch(() => []),
        fetchUsers().catch(() => [])
      ]);
      setInvites(invList);
      setUsers(userList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOpen]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const newInv = await createInvite({
        role,
        max_uses: Number(maxUses),
        expires_in_days: Number(expiresInDays)
      });
      setInvites([newInv, ...invites]);
    } catch (err: any) {
      alert(err.message || 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await deleteInvite(code);
      setInvites(invites.filter((i) => i.code !== code));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invite');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                User & Invite Management
              </h3>
              <p className="text-xs text-zinc-500">
                Invite family and manage registered accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6">
          <button
            onClick={() => setActiveTab('invites')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'invites'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Invites ({invites.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Accounts ({users.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'invites' && (
            <>
              {/* Generator Form */}
              <form
                onSubmit={handleCreateInvite}
                className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl space-y-3"
              >
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Generate New Invite Code
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full text-xs py-1.5 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">Max Uses</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxUses}
                      onChange={(e) => setMaxUses(Number(e.target.value))}
                      className="w-full text-xs py-1.5 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">Expires In (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="w-full text-xs py-1.5 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium cursor-pointer shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Generate Code
                  </button>
                </div>
              </form>

              {/* List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Active & Past Invites
                </div>
                {invites.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">No invite codes generated yet.</p>
                ) : (
                  invites.map((inv) => (
                    <div
                      key={inv.code}
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                            {inv.code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 capitalize">
                            {inv.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-3">
                          <span>
                            Uses: {inv.uses_count} / {inv.max_uses}
                          </span>
                          {inv.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expires {new Date(inv.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(inv.code)}
                          className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode === inv.code ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteInvite(inv.code)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Revoke Invite"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Registered Server Users
              </div>
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                      {u.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        {u.username}
                        {u.id === user?.id && (
                          <span className="text-[10px] text-emerald-500 font-normal">(You)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {u.email || 'No email registered'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
