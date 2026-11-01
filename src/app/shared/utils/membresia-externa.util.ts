import {
  CancelarMembresiaExternaResultado,
  getPlanLabel,
  isSubscriptionAccessible,
  OPOSICION_LABELS,
  REASON_GESTION_EXTERNA_REQUERIDA,
  Suscripcion,
  SuscripcionFuenteGestion,
  SuscripcionStatus,
} from '../models/subscription.model';
import { AuthSource, Usuario } from '../models/user.model';

/** Tipos mínimos de una cuenta para decidir si la baja total externa aplica. */
type UsuarioMembresia = Pick<
  Usuario,
  'nombre' | 'apellidos' | 'email' | 'authSource' | 'woocommerceCustomerId'
> & { suscripciones?: Suscripcion[] };

/**
 * Una suscripción sigue dando acceso si está ACTIVE/PENDING_CANCEL y no tiene
 * fecha de fin pasada. `PENDING_PAYMENT` es una reserva sin cobro confirmado y
 * no cuenta como membresía vigente (mismo criterio que el backend).
 */
export function esSuscripcionVigente(
  suscripcion: Pick<Suscripcion, 'status' | 'fechaFin'>,
  ahora: Date = new Date(),
): boolean {
  if (!isSubscriptionAccessible(suscripcion.status)) {
    return false;
  }
  if (!suscripcion.fechaFin) {
    return true;
  }
  const fechaFin = new Date(suscripcion.fechaFin);
  if (Number.isNaN(fechaFin.getTime())) {
    return false;
  }
  return fechaFin.getTime() > ahora.getTime();
}

/** Suscripciones que el backend cancelaría en una baja total. */
export function suscripcionesVigentes(
  usuario: UsuarioMembresia | null | undefined,
  ahora: Date = new Date(),
): Suscripcion[] {
  return (usuario?.suscripciones ?? []).filter((suscripcion) =>
    esSuscripcionVigente(suscripcion, ahora),
  );
}

function esSuscripcionGestionadaExternamente(
  suscripcion: Suscripcion,
): boolean {
  return (
    suscripcion.fuenteGestion === SuscripcionFuenteGestion.EXTERNA &&
    !suscripcion.woocommerceSubscriptionId
  );
}

/**
 * La baja total solo se ofrece cuando la cuenta es exclusivamente externa:
 * no está vinculada a WordPress (ni por `authSource` ni por customer ID) y
 * TODAS sus suscripciones vigentes son EXTERNA sin ID de WooCommerce.
 *
 * `validated` no participa: hay alumnos de pago histórico sin validar que
 * conservan su acceso. Tampoco se usa `oposiciones` (puede venir firmado en un
 * JWT antiguo); la fuente de verdad es el listado actual de suscripciones.
 */
export function puedeCancelarMembresiaExterna(
  usuario: UsuarioMembresia | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!usuario) return false;
  if (usuario.authSource === AuthSource.WORDPRESS) return false;
  if (
    usuario.woocommerceCustomerId !== null &&
    usuario.woocommerceCustomerId !== undefined
  ) {
    return false;
  }

  const vigentes = suscripcionesVigentes(usuario, ahora);
  return (
    vigentes.length > 0 &&
    vigentes.every((suscripcion) =>
      esSuscripcionGestionadaExternamente(suscripcion),
    )
  );
}

/** Nombre visible de la cuenta, con email como respaldo. */
export function nombreVisibleUsuario(
  usuario: Pick<Usuario, 'nombre' | 'apellidos' | 'email'>,
): string {
  const nombre = `${usuario.nombre ?? ''} ${usuario.apellidos ?? ''}`.trim();
  return nombre || usuario.email;
}

/** Resumen textual de la confirmación; el detalle se pinta como lista. */
export function resumenBajaMembresiaExterna(
  usuario: Pick<Usuario, 'nombre' | 'apellidos' | 'email'>,
  vigentes: Suscripcion[],
): string {
  const total = vigentes.length;
  return (
    `Vas a dar de baja la membresía externa de ${nombreVisibleUsuario(usuario)} ` +
    `(${usuario.email}). Se cancelarán ${total} ` +
    `${total === 1 ? 'suscripción vigente' : 'suscripciones vigentes'}.`
  );
}

/** Detalle legible de una suscripción afectada por la baja total. */
export function describirSuscripcionVigente(suscripcion: Suscripcion): string {
  const plan = getPlanLabel(suscripcion.tipo);
  const oposicion =
    OPOSICION_LABELS[suscripcion.oposicion] ?? suscripcion.oposicion;
  const estado =
    suscripcion.status === SuscripcionStatus.PENDING_CANCEL ||
    !!suscripcion.cancelacionProgramada
      ? 'Baja programada'
      : 'Activa';
  const fin = suscripcion.fechaFin
    ? ` · fin ${new Date(suscripcion.fechaFin).toLocaleDateString('es-ES')}`
    : ' · sin fecha de fin';
  return `${plan} · ${oposicion} · ${estado}${fin}`;
}

/**
 * Copy de la cancelación individual. Deja claro que SOLO afecta a ese plan;
 * antes decía "el usuario perderá el acceso" y parecía una baja global.
 */
export function mensajeConfirmacionCancelacionIndividual(
  etiquetaPlan: string,
): string {
  return (
    `¿Cancelar solo el plan "${etiquetaPlan}"? Se solicitará la baja de este ` +
    'plan; las demás suscripciones, los cursos concedidos y el histórico se ' +
    'conservan.'
  );
}

function cursosConservadosTexto(total: number): string {
  return `${total} curso${
    total === 1 ? ' independiente o concedido' : 's independientes o concedidos'
  }`;
}

/**
 * Actualiza el alumno seleccionado tras una baja total sin pisar una selección
 * más reciente. La relectura del backend puede llegar después de que el admin
 * cierre el diálogo y abra otro alumno; en ese caso se devuelve la selección
 * actual sin tocar.
 *
 * Si la relectura falla, aplica localmente solo los IDs que el servidor
 * confirmó como cancelados.
 */
export function actualizarSeleccionTrasBajaExterna(
  seleccionado: Usuario | null | undefined,
  userId: number,
  recargado: Usuario | null,
  resultado: CancelarMembresiaExternaResultado,
): Usuario | null | undefined {
  if (!seleccionado || seleccionado.id !== userId) {
    return seleccionado;
  }
  if (recargado) {
    return recargado;
  }

  const canceladas = new Set(resultado.canceladas);
  return {
    ...seleccionado,
    suscripciones: (seleccionado.suscripciones ?? []).map((suscripcion) =>
      canceladas.has(suscripcion.id)
        ? {
            ...suscripcion,
            status: SuscripcionStatus.CANCELLED,
            fechaFin: new Date(),
            cancelacionProgramada: undefined,
          }
        : suscripcion,
    ),
  };
}

/** Mensaje de éxito o no-op usando SIEMPRE los contadores del servidor. */
export function mensajeResultadoBajaMembresiaExterna(
  resultado: CancelarMembresiaExternaResultado,
): { severity: 'success' | 'info'; message: string } {
  const cursos =
    `Se conservaron ${cursosConservadosTexto(resultado.cursosConservados)}, ` +
    'con su progreso e histórico.';

  if (resultado.yaEstabaDeBaja || resultado.totalCanceladas === 0) {
    return {
      severity: 'info',
      message: `La membresía externa ya estaba de baja. No se canceló ninguna suscripción. ${cursos}`,
    };
  }

  const total = resultado.totalCanceladas;
  return {
    severity: 'success',
    message:
      `Membresía externa dada de baja: ${total} ` +
      `${total === 1 ? 'suscripción cancelada' : 'suscripciones canceladas'}. ` +
      cursos,
  };
}

interface ErrorBajaMembresia {
  status?: number;
  reason?: string;
  message?: string;
  error?: { reason?: string; message?: string };
}

/**
 * Traduce el error del contrato. El 409 GESTION_EXTERNA_REQUERIDA no es un
 * fallo genérico: la cuenta es WordPress/mixta o ya no tiene gestión externa,
 * y el backend no ha escrito nada.
 */
export function mensajeErrorBajaMembresiaExterna(
  error: ErrorBajaMembresia | null | undefined,
): string {
  const status = error?.status;
  const reason = error?.reason ?? error?.error?.reason;

  if (status === 409 && reason === REASON_GESTION_EXTERNA_REQUERIDA) {
    return (
      'Esta cuenta no tiene una membresía exclusivamente externa: es de ' +
      'WordPress, mezcla gestiones o ya no queda ninguna suscripción externa. ' +
      'No se ha modificado nada; gestiona las suscripciones de WooCommerce ' +
      'desde su panel.'
    );
  }
  if (status === 403) {
    return 'No tienes permiso para dar de baja esta membresía.';
  }
  if (status === 404) {
    return 'El usuario ya no existe. Actualiza el listado e inténtalo de nuevo.';
  }
  if (status === 400) {
    return 'La solicitud de baja no es válida. Revisa el motivo e inténtalo de nuevo.';
  }

  return (
    error?.message ||
    error?.error?.message ||
    'No se pudo dar de baja la membresía externa. No se ha modificado nada.'
  );
}
