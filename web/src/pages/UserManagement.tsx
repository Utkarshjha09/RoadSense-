import { useEffect, useState } from 'react'
import { getAllUsers, updateUserRole, getUserContributions } from '../lib/queries'
import { Profile } from '../lib/supabase'
import { Users, Shield } from 'lucide-react'

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

    async function handleRoleChange(userId: string, newRole: 'driver' | 'admin') {
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
                <div className="text-white text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-3">
                        <Users className="text-blue-500" size={24} />
                        <div>
                            <p className="text-slate-400 text-sm">Total Users</p>
                            <p className="text-2xl font-bold text-white">{users.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-3">
                        <Shield className="text-green-500" size={24} />
                        <div>
                            <p className="text-slate-400 text-sm">Admins</p>
                            <p className="text-2xl font-bold text-white">
                                {users.filter((u) => u.role === 'admin').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-3">
                        <Users className="text-yellow-500" size={24} />
                        <div>
                            <p className="text-slate-400 text-sm">Drivers</p>
                            <p className="text-2xl font-bold text-white">
                                {users.filter((u) => u.role === 'driver').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Score
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {user.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {user.full_name || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-blue-500/20 text-blue-400'
                                                }`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {user.score}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <select
                                            value={user.role}
                                            onChange={(e) =>
                                                handleRoleChange(user.id, e.target.value as 'driver' | 'admin')
                                            }
                                            className="bg-slate-700 text-white px-3 py-1 rounded-lg border border-slate-600 text-sm"
                                        >
                                            <option value="driver">Driver</option>
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
