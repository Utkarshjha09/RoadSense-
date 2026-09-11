import { useEffect, useState } from 'react'
import { getAllUsers, updateUserRole } from '../lib/queries'
import { Profile } from '../lib/supabase'
import { Users } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'
import { Card, Pill, StatCard, EmptyState, type Tone } from '../components/ui'

const ROLE_TONE: Record<string, Tone> = {
    admin: 'success',
    owner: 'warn',
    driver: 'primary',
}

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
        if (!confirm(`Change this user's role to ${newRole}?`)) return

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
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoaderBars label="Loading users" />
            </div>
        )
    }

    const adminCount = users.filter((user) => user.role === 'admin').length

    return (
        <div className="space-y-5 rs-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total Users" value={users.length} caption="All registered accounts" />
                <StatCard label="Admins" value={adminCount} caption="Full access" />
                <StatCard
                    label="Drivers / Owners"
                    value={users.length - adminCount}
                    caption="Standard access"
                />
            </div>

            <Card className="overflow-hidden">
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rs-line)]">
                    <div>
                        <h2 className="rs-heading">All Users</h2>
                        <p className="text-[13px] text-[var(--rs-text-faint)] mt-0.5">Access control</p>
                    </div>
                    <Pill tone="neutral">{users.length} total</Pill>
                </div>

                <div className="overflow-x-auto">
                    <table className="rs-table min-w-[48rem]">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Score</th>
                                <th>Joined</th>
                                <th>Change Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="whitespace-nowrap text-[var(--rs-text)]">{user.email}</td>
                                    <td className="whitespace-nowrap rs-muted">{user.full_name || '—'}</td>
                                    <td>
                                        <Pill tone={ROLE_TONE[user.role] ?? 'neutral'}>{user.role}</Pill>
                                    </td>
                                    <td className="rs-mono text-[var(--rs-text)]">{user.score}</td>
                                    <td className="whitespace-nowrap rs-muted rs-mono text-xs">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <select
                                            value={user.role}
                                            onChange={(event) =>
                                                handleRoleChange(user.id, event.target.value as 'driver' | 'owner' | 'admin')
                                            }
                                            className="rs-select text-sm py-1.5 min-w-[7.5rem]"
                                            aria-label={`Role for ${user.email}`}
                                        >
                                            <option value="driver">Driver</option>
                                            <option value="owner">Owner</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState icon={Users} title="No users yet" description="Accounts appear here once people sign up." />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
