'use client'

import { createRoot } from 'react-dom/client'
import ConfirmModal from './ConfirmModal'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

/**
 * Sustituto de window.confirm() con el modal propio de la app.
 *
 * window.confirm queda bloqueado por el navegador cuando el usuario marca
 * "no volver a mostrar diálogos", y entonces el botón parece no hacer nada.
 * Este helper monta el ConfirmModal en un nodo temporal y devuelve una
 * promesa con la decisión del usuario.
 */
export function confirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)

  return new Promise<boolean>(resolve => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const close = (value: boolean) => {
      root.unmount()
      host.remove()
      resolve(value)
    }

    root.render(
      <ConfirmModal
        open
        title={opts.title ?? 'Confirmar'}
        message={opts.message}
        confirmLabel={opts.confirmLabel ?? 'Eliminar'}
        cancelLabel={opts.cancelLabel ?? 'Cancelar'}
        danger={opts.danger ?? true}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    )
  })
}
