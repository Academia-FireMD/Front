import { Injectable } from '@angular/core';
import { importeConfirmadoEnCentimos } from './importe-confirmado.util';

export const SIMULACRO_COMPRA_STORAGE_PREFIX = 'academia:compra-simulacro:v2:';

export interface SimulacroCompraIntento {
  usuarioId: number;
  examenId: number;
  idempotencyKey: string;
  importeConfirmado: number;
  enviado: boolean;
}

@Injectable({ providedIn: 'root' })
export class SimulacroCompraIntentoService {
  obtenerOCrear(
    usuarioId: number,
    examenId: number,
    importeVisible: number | null | undefined,
  ): SimulacroCompraIntento {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw new Error('No se pudo identificar al alumno para la compra.');
    }
    if (!Number.isInteger(examenId) || examenId <= 0) {
      throw new Error('El simulacro no es válido para comprar.');
    }

    const storageKey = this.storageKey(usuarioId, examenId);
    const importe = importeConfirmadoEnCentimos(importeVisible);
    const guardado = this.leer(storageKey);
    if (guardado) {
      if (
        guardado.usuarioId !== usuarioId ||
        guardado.examenId !== examenId ||
        !this.esClaveV2(guardado.idempotencyKey) ||
        importeConfirmadoEnCentimos(guardado.importeConfirmado) !==
          guardado.importeConfirmado ||
        typeof guardado.enviado !== 'boolean'
      ) {
        throw new Error(
          'No se pudo recuperar el intento de compra pendiente; no se iniciará otro.',
        );
      }
      // Antes del primer POST aún no existe un resultado monetario que deduplicar.
      // Si cambia el precio visible, el importe debe confirmarse con una key nueva.
      if (
        !guardado.enviado &&
        importe !== null &&
        importe !== guardado.importeConfirmado
      ) {
        const actualizado: SimulacroCompraIntento = {
          ...guardado,
          idempotencyKey: `simulacro_v2_${this.generarUuid()}`,
          importeConfirmado: importe,
        };
        this.guardar(storageKey, actualizado);
        return actualizado;
      }
      return guardado;
    }

    if (importe === null) {
      throw new Error('El simulacro no tiene un precio válido para comprar.');
    }

    const nuevo: SimulacroCompraIntento = {
      usuarioId,
      examenId,
      idempotencyKey: `simulacro_v2_${this.generarUuid()}`,
      importeConfirmado: importe,
      enviado: false,
    };
    this.guardar(storageKey, nuevo);
    return nuevo;
  }

  marcarEnviado(intento: SimulacroCompraIntento): void {
    const storageKey = this.storageKey(intento.usuarioId, intento.examenId);
    const actual = this.leer(storageKey);
    if (!actual || actual.idempotencyKey !== intento.idempotencyKey) {
      throw new Error(
        'El intento de compra cambió antes de enviarse; no se iniciará otro.',
      );
    }
    if (!actual.enviado) this.guardar(storageKey, { ...actual, enviado: true });
  }

  finalizar(intento: SimulacroCompraIntento): void {
    const storageKey = this.storageKey(intento.usuarioId, intento.examenId);
    const actual = this.leer(storageKey);
    if (actual?.idempotencyKey === intento.idempotencyKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        throw new Error('No se pudo cerrar el intento de compra.');
      }
    }
  }

  private storageKey(usuarioId: number, examenId: number): string {
    return `${SIMULACRO_COMPRA_STORAGE_PREFIX}${usuarioId}:${examenId}`;
  }

  private leer(storageKey: string): SimulacroCompraIntento | null {
    let raw: string | null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      throw new Error('No se pudo recuperar el intento de compra pendiente.');
    }
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Registro de intento no válido.');
      }
      return parsed as SimulacroCompraIntento;
    } catch {
      throw new Error(
        'No se pudo recuperar el intento de compra pendiente; no se iniciará otro.',
      );
    }
  }

  private guardar(storageKey: string, intento: SimulacroCompraIntento): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(intento));
    } catch {
      throw new Error(
        'No se pudo guardar el intento de compra; no se iniciará el pago.',
      );
    }
  }

  private esClaveV2(clave: string): boolean {
    return /^simulacro_v2_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clave,
    );
  }

  private generarUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  }
}
