import type { Pregunta } from '../../shared/models/pregunta.model';
import type { Oposicion } from '../../shared/models/subscription.model';
import type { Test } from '../../shared/models/test.model';
import type { MetodoCalificacion } from '../../shared/models/user.model';

export enum EstadoExamen {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  ARCHIVADO = 'ARCHIVADO',
}

export enum TipoAcceso {
  PUBLICO = 'PUBLICO',
  RESTRINGIDO = 'RESTRINGIDO',
  SIMULACRO = 'SIMULACRO',
  COLABORATIVO = 'COLABORATIVO',
}

export interface CondicionColaborativa {
  id?: number;
  numeroPreguntas: number;
  temasRequeridos: number[];
  orden?: number;
}

export interface Examen {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: number;
  estado: EstadoExamen;
  tipoAcceso: TipoAcceso;
  codigoAcceso?: string;
  fechaActivacion?: Date;
  fechaSolucion?: Date;
  fechaPreparatoria?: Date;
  fechaFinPreparatoria?: Date;
  numeroPreguntas?: number;
  temasColaborativos?: number[];
  condicionesColaborativas?: CondicionColaborativa[];
  metodoCalificacion?: MetodoCalificacion;
  relevancia: Oposicion[];
  creadorId: number;
  testId?: number;
  test?: Test;
  preguntas?: Pregunta[];
  preguntasReserva?: Pregunta[];

  // Campos de vinculación con WooCommerce para simulacros
  woocommerceProductId?: string;
  woocommerceSku?: string;
  woocommerceProductName?: string;
  /**
   * Precio de compra in-app (1-clic COF), derivado del cache de WooCommerce por
   * el backend en el detalle del simulacro. `null` ⇒ no comprable in-app (sin
   * producto WC, no publicado o sin precio válido). Solo para mostrar; el cobro
   * revalida el precio real en el servidor.
   */
  precioSimulacro?: number | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Respuesta de la compra in-app de un simulacro por COF (1-clic). Misma forma
 * que la de cursos salvo que el éxito devuelve `consumibleId` y `wooProductId`
 * es un string (Examen.woocommerceProductId). No hay caso "YA_TIENES": un
 * simulacro es un consumible comprable varias veces.
 */
export type ComprarSimulacroCofResponse =
  | { success: true; consumibleId?: number; mensaje: string }
  | {
      success: false;
      requiereCheckout: true;
      wooProductId: string;
      mensaje: string;
    }
  | {
      success: false;
      error: 'PAGO_RECHAZADO' | 'ERROR_TEMPORAL';
      wooProductId?: string;
      mensaje: string;
    };
