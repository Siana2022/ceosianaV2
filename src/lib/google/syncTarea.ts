import { createAdminClient } from '@/lib/server/supabase-admin'
import { getValidAccessToken } from './getToken'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, type CalendarEventInput } from './calendar'

export async function syncTareaToCalendar(tareaId: string, userId: string, input: CalendarEventInput | null) {
  try {
    const token = await getValidAccessToken(userId)
    if (!token) return  // user hasn't connected Calendar

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('tarea_calendar_events')
      .select('google_event_id, calendar_id')
      .eq('tarea_id', tareaId)
      .eq('user_id', userId)
      .maybeSingle()

    if (input === null) {
      // Delete event
      if (existing?.google_event_id) {
        await deleteCalendarEvent(token.accessToken, existing.calendar_id, existing.google_event_id)
        await admin.from('tarea_calendar_events').delete().eq('tarea_id', tareaId).eq('user_id', userId)
      }
      return
    }

    if (existing?.google_event_id) {
      await updateCalendarEvent(token.accessToken, existing.calendar_id, existing.google_event_id, input)
    } else {
      const eventId = await createCalendarEvent(token.accessToken, token.calendarId, input)
      await admin.from('tarea_calendar_events').upsert({ tarea_id: tareaId, user_id: userId, google_event_id: eventId, calendar_id: token.calendarId })
    }
  } catch (e) {
    console.error('[syncTarea] Error syncing to Calendar:', e)
  }
}

export async function syncTareaToAllResponsables(tareaId: string, empleadoIds: string[], input: CalendarEventInput | null) {
  if (!empleadoIds.length) return
  const admin = createAdminClient()

  // empleadoIds are from the `empleados` table — map to Supabase auth user IDs via email
  const { data: empleados } = await admin
    .from('empleados')
    .select('email')
    .in('id', empleadoIds)

  const emails = new Set((empleados ?? []).map((e: { email: string }) => e.email).filter(Boolean))
  if (!emails.size) return

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 500 })
  const authIds = users.filter(u => u.email && emails.has(u.email)).map(u => u.id)

  await Promise.allSettled(authIds.map(uid => syncTareaToCalendar(tareaId, uid, input)))
}
