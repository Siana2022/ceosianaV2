import { createAdminClient } from '@/lib/server/supabase-admin'
import { revalidatePath } from 'next/cache'

interface Props {
  params: Promise<{ token: string }>
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fecha(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES[Number(m) - 1]} ${y}`
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: cliente } = await admin
    .from('clientes')
    .select('id, nombre, token_portal')
    .eq('token_portal', token)
    .maybeSingle()

  if (!cliente) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Enlace no válido</h1>
        <p style={{ color: '#666' }}>Este enlace ha caducado o se ha revocado. Pide uno nuevo a tu contacto en Siana.</p>
      </main>
    )
  }

  const [{ data: servicios }, { data: tareas }, { data: notas }, { data: aprobaciones }] = await Promise.all([
    admin.from('servicios').select('id, nombre, descripcion, activo').eq('id_cliente', cliente.id).or('activo.eq.true,activo.is.null').order('nombre'),
    admin.from('tareas').select('id, nombre, estado, fecha_limite, id_servicio, visibilidad').eq('id_cliente', cliente.id).eq('visibilidad', 'compartida').order('fecha_limite', { ascending: true }),
    admin.from('notas_conocimiento').select('id, titulo, contenido, created_at').eq('id_cliente', cliente.id).eq('visibilidad', 'compartida').order('created_at', { ascending: false }).limit(20),
    admin.from('aprobaciones').select('id, id_tarea, estado, comentario, created_at').eq('id_cliente', cliente.id).order('created_at', { ascending: false }).limit(10),
  ])

  const progresoPorServicio = new Map<string, { total: number; hechas: number }>()
  for (const t of tareas ?? []) {
    if (!t.id_servicio) continue
    const acc = progresoPorServicio.get(t.id_servicio) ?? { total: 0, hechas: 0 }
    acc.total += 1
    if (t.estado === 'terminado') acc.hechas += 1
    progresoPorServicio.set(t.id_servicio, acc)
  }

  async function aprobar(formData: FormData) {
    'use server'
    const idTarea = String(formData.get('id_tarea') ?? '')
    const autor = String(formData.get('autor') ?? '').trim() || 'Cliente'
    const comentario = String(formData.get('comentario') ?? '').trim()
    if (!idTarea) return

    const db = createAdminClient()
    await db.from('aprobaciones').insert({
      id_cliente: cliente!.id,
      id_tarea: idTarea,
      estado: comentario ? 'comentada' : 'aprobada',
      comentario: comentario || null,
      autor,
    })
    revalidatePath(`/portal/${token}`)
  }

  const pendientes = (tareas ?? []).filter(t => t.estado !== 'terminado' && !(aprobaciones ?? []).some(a => a.id_tarea === t.id))

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111' }}>
      <header style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>Siana Digital</div>
        <h1 style={{ fontSize: 32, margin: '6px 0 0', fontWeight: 700 }}>{cliente.nombre}</h1>
        <p style={{ color: '#666', margin: '6px 0 0', fontSize: 14 }}>Espacio de seguimiento del proyecto</p>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Proyectos</h2>
        {(servicios ?? []).length === 0 && <p style={{ color: '#777', fontSize: 14 }}>Sin proyectos activos.</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          {(servicios ?? []).map(s => {
            const p = progresoPorServicio.get(s.id)
            const pct = p && p.total > 0 ? Math.round((p.hechas / p.total) * 100) : 0
            return (
              <div key={s.id} style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.nombre}</div>
                    {s.descripcion && <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{s.descripcion}</div>}
                  </div>
                  <div style={{ color: '#666', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {p ? `${p.hechas}/${p.total} tareas` : 'sin tareas'}
                  </div>
                </div>
                <div style={{ height: 6, background: '#eee', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#059669' }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Tareas compartidas</h2>
        {(tareas ?? []).length === 0 && <p style={{ color: '#777', fontSize: 14 }}>No hay tareas compartidas todavía.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {(tareas ?? []).map(t => {
            const ap = (aprobaciones ?? []).find(a => a.id_tarea === t.id)
            return (
              <div key={t.id} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{t.nombre}</div>
                    <div style={{ color: '#777', fontSize: 12, marginTop: 2 }}>
                      {t.estado === 'terminado' ? 'Terminada' : t.estado === 'proceso' ? 'En curso' : 'Pendiente'}
                      {t.fecha_limite ? ` · ${fecha(t.fecha_limite)}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: ap ? '#059669' : '#888' }}>
                    {ap ? (ap.estado === 'comentada' ? 'Con comentarios' : 'Aprobada') : 'Pendiente de aprobación'}
                  </div>
                </div>

                {!ap && (
                  <form action={aprobar} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <input type="hidden" name="id_tarea" value={t.id} />
                    <input name="autor" placeholder="Tu nombre" style={{ flex: '0 0 160px', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
                    <input name="comentario" placeholder="Comentario (opcional)" style={{ flex: 1, minWidth: 200, border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
                    <button type="submit" style={{ background: '#111', color: '#fff', border: 0, borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Aprobar
                    </button>
                  </form>
                )}
                {ap?.comentario && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#444' }}>“{ap.comentario}”</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Conocimiento</h2>
        {(notas ?? []).length === 0 && <p style={{ color: '#777', fontSize: 14 }}>Sin notas compartidas.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {(notas ?? []).map(n => (
            <div key={n.id} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.titulo}</div>
              {n.contenido && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#444', whiteSpace: 'pre-wrap' }}>{n.contenido}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Resultados</h2>
        <div style={{ border: '1px dashed #ddd', borderRadius: 10, padding: 18, color: '#888', fontSize: 13 }}>
          Inversión, CPA y ROAS de tus campañas aparecerán aquí cuando estén conectadas las cuentas de Google y Meta.
        </div>
      </section>

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #eee', color: '#999', fontSize: 12 }}>
        Compartido por Siana Digital · {pendientes.length} tarea{pendientes.length === 1 ? '' : 's'} pendiente{pendientes.length === 1 ? '' : 's'} de aprobar
      </footer>
    </main>
  )
}
