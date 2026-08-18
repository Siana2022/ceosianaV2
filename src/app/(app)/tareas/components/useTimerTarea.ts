'use client'

import { useTareas } from '../store'
import type { Tarea } from '../types'

const TIMER_KEY = 'ceosiana_timer_v2'

// Hook compartido para iniciar/parar el timer real de una tarea.
// Escribe en el mismo localStorage que /fichar para que ambas vistas estén sincronizadas.
export function useTimerTarea() {
  const { actions } = useTareas()

  const toggleTimer = async (tarea: Tarea, e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (tarea.timerActivo) {
      // ── PARAR ──────────────────────────────────────────────────────
      let minutosElapsed = 1
      let dbId: string | null = null
      try {
        const saved = localStorage.getItem(TIMER_KEY)
        if (saved) {
          const { startTs, dbId: id, tareaId } = JSON.parse(saved)
          if (tareaId === tarea.id && id && startTs) {
            dbId = id
            minutosElapsed = Math.max(1, Math.round((Date.now() - startTs) / 60000))
          }
        }
      } catch {}
      if (dbId) {
        const ahora = new Date()
        fetch(`/api/time-logs?id=${dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hora_fin: ahora.toTimeString().slice(0, 5), minutos: minutosElapsed }),
        }).catch(e => console.error('[timer] PATCH error', e))
      }
      localStorage.removeItem(TIMER_KEY)
      actions.actualizarTarea(tarea.id, {
        timerActivo: false,
        minutosAcumulados: tarea.minutosAcumulados + minutosElapsed,
      })
    } else {
      // ── INICIAR ─────────────────────────────────────────────────────
      const ahora = new Date()
      try {
        const res = await fetch('/api/time-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cliente: tarea.idCliente,
            id_servicio: tarea.idServicio,
            id_departamento: tarea.idDepartamento,
            descripcion: tarea.nombre,
            fecha: ahora.toISOString().slice(0, 10),
            hora_inicio: ahora.toTimeString().slice(0, 5),
            minutos: 0,
            timer_abierto: true,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al fichar')
        localStorage.setItem(TIMER_KEY, JSON.stringify({
          startTs: ahora.getTime(),
          d: tarea.nombre,
          c: tarea.idCliente ?? '',
          dep: tarea.idDepartamento ?? '',
          dbId: data.id,
          tareaId: tarea.id,
        }))
        actions.actualizarTarea(tarea.id, { timerActivo: true })
      } catch (err) {
        console.error('[timer] Error al iniciar:', err)
      }
    }
  }

  return { toggleTimer }
}
