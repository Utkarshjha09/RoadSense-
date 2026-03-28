import { useEffect, useState } from 'react'
import { getAllUsers, updateUserRole } from '../lib/queries'
import { Profile } from '../lib/supabase'
import { Users, Shield } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'

export default function UserManagement() {
    const [users, setUsers] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        try {
            const data = await getAllUsers()
            setUsers(data)
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleRoleChange(userId: string, newRole: 'driver' | 'owner' | 'admin') {
        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return

        try {
            await updateUserRole(userId, newRole)
            loadUsers()
        } catch (error) {
            console.error('Error updating role:', error)
            alert('Failed to update user role')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoaderBars label="Loading users..." />
            </div>
        )
    }

    return (
        <div className="space-y-6 rs-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rs-panel p-6">
                    <div className="flex items-center gap-3">
                        <Users className="text-cyan-300" size={24} />
                        <div>
                            <p className="text-[var(--rs-muted)] text-sm">Total Users</p>
                            <p className="text-2xl font-bold text-[var(--rs-text)]">{users.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rs-panel p-6">
                    <div className="flex items-center gap-3">
                        <Shield className="text-emerald-300" size={24} />
                        <div>
                            <p className="text-[var(--rs-muted)] text-sm">Admins</p>
                            <p className="text-2xl font-bold text-[var(--rs-text)]">{users.filter((u) => u.role === 'admin').length}</p>
                        </div>
                    </div>
                </div>
                <div className="rs-panel p-6">
                    <div className="flex items-center gap-3">
                        <Users className="text-amber-300" size={24} />
                        <div>
                            <p className="text-[var(--rs-muted)] text-sm">Drivers / Owners</p>
                            <p className="text-2xl font-bold text-[var(--rs-text)]">{users.filter((u) => u.role !== 'admin').length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rs-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full rs-table">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Score</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rs-border)]">
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-muted)]">{user.full_name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            user.role === 'admin'
                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                : user.role === 'owner'
                                                    ? 'bg-amber-500/15 text-amber-300'
                                                    : 'bg-cyan-500/15 text-cyan-300'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{user.score}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-muted)]">{new Date(user.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value as 'driver' | 'owner' | 'admin')}
                                            className="rs-select text-sm min-w-[120px]"
                                        >
                                            <option value="driver">Driver</option>
                                            <option value="owner">Owner</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
