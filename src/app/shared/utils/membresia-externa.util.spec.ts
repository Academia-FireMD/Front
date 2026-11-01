import {
  CancelarMembresiaExternaResultado,
  Oposicion,
  REASON_GESTION_EXTERNA_REQUERIDA,
  Suscripcion,
  SuscripcionFuenteGestion,
  SuscripcionStatus,
  SuscripcionTipo,
} from '../models/subscription.model';
import { AuthSource, Rol, Usuario } from '../models/user.model';
import {
  actualizarSeleccionTrasBajaExterna,
  esSuscripcionVigente,
  mensajeConfirmacionCancelacionIndividual,
  mensajeErrorBajaMembresiaExterna,
  mensajeResultadoBajaMembresiaExterna,
  puedeCancelarMembresiaExterna,
  resumenBajaMembresiaExterna,
  suscripcionesVigentes,
} from './membresia-externa.util';

const AHORA = new Date('2026-11-01T12:00:00.000Z');

function sub(overrides: Partial<Suscripcion> = {}): Suscripcion {
  return {
    id: 1,
    usuarioId: 7,
    tipo: SuscripcionTipo.BASIC,
    oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
    fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
    fechaFin: null,
    status: SuscripcionStatus.ACTIVE,
    isOfferPlan: false,
    fuenteGestion: SuscripcionFuenteGestion.EXTERNA,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 7,
    email: 'alumno@test.com',
    nombre: 'Ana',
    apellidos: 'Pérez',
    rol: Rol.ALUMNO,
    validated: false,
    authSource: AuthSource.LOCAL,
    woocommerceCustomerId: undefined,
    suscripciones: [sub()],
    ...overrides,
  } as Usuario;
}

describe('membresía externa — vigencia y elegibilidad', () => {
  it.each([
    [SuscripcionStatus.ACTIVE, null, true],
    [SuscripcionStatus.ACTIVE, '2026-11-01T12:00:01.000Z', true],
    [SuscripcionStatus.PENDING_CANCEL, '2026-11-15T00:00:00.000Z', true],
    [SuscripcionStatus.ACTIVE, '2026-10-31T00:00:00.000Z', false],
    [SuscripcionStatus.PENDING_CANCEL, '2026-10-31T00:00:00.000Z', false],
    [SuscripcionStatus.CANCELLED, null, false],
    [SuscripcionStatus.PENDING_PAYMENT, null, false],
  ])('estado %s con fechaFin %s → vigente=%s', (status, fechaFin, esperado) => {
    expect(
      esSuscripcionVigente(
        sub({
          status,
          fechaFin: fechaFin ? new Date(fechaFin) : null,
        }),
        AHORA,
      ),
    ).toBe(esperado);
  });

  it('lista solo las suscripciones que aún dan acceso', () => {
    const user = usuario({
      suscripciones: [
        sub({ id: 1 }),
        sub({
          id: 2,
          status: SuscripcionStatus.PENDING_CANCEL,
          fechaFin: new Date('2026-11-20T00:00:00.000Z'),
        }),
        sub({ id: 3, fechaFin: new Date('2026-09-01T00:00:00.000Z') }),
        sub({ id: 4, status: SuscripcionStatus.CANCELLED }),
        sub({ id: 5, status: SuscripcionStatus.PENDING_PAYMENT }),
      ],
    });

    expect(suscripcionesVigentes(user, AHORA).map((s) => s.id)).toEqual([1, 2]);
  });

  it('un alumno de pago sin validar conserva la elegibilidad', () => {
    expect(puedeCancelarMembresiaExterna(usuario(), AHORA)).toBe(true);
  });

  it('no ofrece la baja total si alguna suscripción vigente es de WooCommerce', () => {
    const user = usuario({
      suscripciones: [
        sub({ id: 1 }),
        sub({
          id: 2,
          fuenteGestion: SuscripcionFuenteGestion.WOOCOMMERCE,
          woocommerceSubscriptionId: '99_abc',
        }),
      ],
    });
    expect(puedeCancelarMembresiaExterna(user, AHORA)).toBe(false);
  });

  it('no ofrece la baja total si la cuenta está vinculada a WordPress', () => {
    expect(
      puedeCancelarMembresiaExterna(
        usuario({ authSource: AuthSource.WORDPRESS }),
        AHORA,
      ),
    ).toBe(false);
    expect(
      puedeCancelarMembresiaExterna(
        usuario({ woocommerceCustomerId: 123 }),
        AHORA,
      ),
    ).toBe(false);
  });

  it('no ofrece la baja total si no queda ninguna suscripción vigente', () => {
    expect(
      puedeCancelarMembresiaExterna(
        usuario({
          suscripciones: [
            sub({ status: SuscripcionStatus.CANCELLED }),
            sub({ status: SuscripcionStatus.PENDING_PAYMENT }),
          ],
        }),
        AHORA,
      ),
    ).toBe(false);
  });

  it('no ofrece la baja total sin fuente EXTERNA explícita', () => {
    expect(
      puedeCancelarMembresiaExterna(
        usuario({
          suscripciones: [
            sub({ fuenteGestion: undefined, woocommerceSubscriptionId: null }),
          ],
        }),
        AHORA,
      ),
    ).toBe(false);
  });

  it('el resumen identifica al alumno y cuenta las suscripciones afectadas', () => {
    const user = usuario();
    expect(
      resumenBajaMembresiaExterna(user, [sub({ id: 1 }), sub({ id: 2 })]),
    ).toBe(
      'Vas a dar de baja la membresía externa de Ana Pérez (alumno@test.com). Se cancelarán 2 suscripciones vigentes.',
    );
  });
});

describe('membresía externa — copy de confirmación y resultado', () => {
  it('la cancelación individual deja claro que solo afecta a ese plan', () => {
    const copy = mensajeConfirmacionCancelacionIndividual(
      'Básica - Valencia Ayuntamiento',
    );
    expect(copy).toContain('solo el plan');
    expect(copy).toContain('las demás suscripciones');
    expect(copy).toContain('conservan');
    expect(copy).not.toContain('perderá el acceso');
  });

  it('el éxito usa totalCanceladas y cursosConservados del servidor', () => {
    const resultado: CancelarMembresiaExternaResultado = {
      usuarioId: 7,
      canceladas: [11, 12],
      totalCanceladas: 2,
      yaEstabaDeBaja: false,
      cursosConservados: 3,
    };
    expect(mensajeResultadoBajaMembresiaExterna(resultado)).toEqual({
      severity: 'success',
      message:
        'Membresía externa dada de baja: 2 suscripciones canceladas. Se conservaron 3 cursos independientes o concedidos, con su progreso e histórico.',
    });
  });

  it('el no-op idempotente informa sin inventar cancelaciones', () => {
    const resultado: CancelarMembresiaExternaResultado = {
      usuarioId: 7,
      canceladas: [],
      totalCanceladas: 0,
      yaEstabaDeBaja: true,
      cursosConservados: 1,
    };
    expect(mensajeResultadoBajaMembresiaExterna(resultado)).toEqual({
      severity: 'info',
      message:
        'La membresía externa ya estaba de baja. No se canceló ninguna suscripción. Se conservaron 1 curso independiente o concedido, con su progreso e histórico.',
    });
  });

  it('traduce el 409 GESTION_EXTERNA_REQUERIDA sin culpar al admin', () => {
    const mensaje = mensajeErrorBajaMembresiaExterna({
      status: 409,
      reason: REASON_GESTION_EXTERNA_REQUERIDA,
    });
    expect(mensaje).toContain('exclusivamente externa');
    expect(mensaje).toContain('No se ha modificado nada');
  });

  it('conserva el mensaje del backend para errores no clasificados', () => {
    expect(
      mensajeErrorBajaMembresiaExterna({
        status: 500,
        message: 'Fallo interno controlado',
      }),
    ).toBe('Fallo interno controlado');
  });
});

describe('membresía externa — actualización asíncrona de la selección', () => {
  const resultado: CancelarMembresiaExternaResultado = {
    usuarioId: 140,
    canceladas: [701, 702],
    totalCanceladas: 2,
    yaEstabaDeBaja: false,
    cursosConservados: 1,
  };

  it('una relectura tardía NO pisa al alumno seleccionado después', () => {
    const seleccionadoAhora = usuario({
      id: 141,
      nombre: 'Marta',
      suscripciones: [sub({ id: 900 })],
    });
    const recargadoAnterior = usuario({
      id: 140,
      nombre: 'Lucía',
      suscripciones: [],
    });

    const actualizado = actualizarSeleccionTrasBajaExterna(
      seleccionadoAhora,
      140,
      recargadoAnterior,
      resultado,
    );

    expect(actualizado).toBe(seleccionadoAhora);
    expect(actualizado?.id).toBe(141);
    expect(actualizado?.suscripciones?.[0].id).toBe(900);
  });

  it('si la selección sigue siendo el alumno cancelado, aplica la relectura', () => {
    const seleccionado = usuario({ id: 140, suscripciones: [] });
    const recargado = usuario({
      id: 140,
      suscripciones: [sub({ id: 701, status: SuscripcionStatus.CANCELLED })],
    });

    expect(
      actualizarSeleccionTrasBajaExterna(
        seleccionado,
        140,
        recargado,
        resultado,
      ),
    ).toBe(recargado);
  });

  it('si la relectura falla, marca localmente solo los IDs cancelados', () => {
    const seleccionado = usuario({
      id: 140,
      suscripciones: [
        sub({ id: 701, status: SuscripcionStatus.ACTIVE }),
        sub({ id: 702, status: SuscripcionStatus.PENDING_CANCEL }),
        sub({ id: 703, status: SuscripcionStatus.ACTIVE }),
      ],
    });

    const actualizado = actualizarSeleccionTrasBajaExterna(
      seleccionado,
      140,
      null,
      resultado,
    );

    expect(actualizado?.suscripciones?.map((s) => [s.id, s.status])).toEqual([
      [701, SuscripcionStatus.CANCELLED],
      [702, SuscripcionStatus.CANCELLED],
      [703, SuscripcionStatus.ACTIVE],
    ]);
  });
});
