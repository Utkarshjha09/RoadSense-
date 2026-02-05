import { useAuth } from '../AuthProvider'

export default function Header({ title }: { title: string }) {
    const { user } = useAuth()

    return (
        <div className="bg-slate-800 border-b border-slate-700 px-8 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{title}</h2>

            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-sm font-medium text-white">{user?.email}</p>
                    <p className="text-xs text-slate-400">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                        {user?.email?.charAt(0).toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    )
}
