import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/dashboard')

  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            CEO<span className="text-blue-500">SIANA</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Panel de dirección</p>
        </div>

        <form action={login} className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{decodeURIComponent(error)}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
