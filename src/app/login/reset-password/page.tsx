import { resetPassword } from '../actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            CEO<span className="text-blue-500">SIANA</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Recuperar contraseña</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-4">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-white font-semibold">Revisa tu correo</p>
              <p className="text-gray-400 text-sm">Te hemos enviado un enlace para restablecer tu contraseña.</p>
              <a href="/login" className="block text-blue-400 text-sm hover:text-blue-300 transition-colors">
                ← Volver al login
              </a>
            </div>
          ) : (
            <form action={resetPassword} className="space-y-4">
              <p className="text-gray-400 text-sm">Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  name="email"
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
                Enviar enlace
              </button>

              <a href="/login" className="block text-center text-gray-500 text-sm hover:text-gray-300 transition-colors">
                ← Volver al login
              </a>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
