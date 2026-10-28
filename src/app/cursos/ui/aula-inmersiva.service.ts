import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Presentación temporal a pantalla completa del aula APLICACION (2026-10-28).
 *
 * El aula inmersiva no persiste en localStorage: se activa mientras la lección
 * de entrada válida está montada y se libera al cargar/error/cambiar lección,
 * navegar, destruir o cerrar sesión. El Layout global oculta sus barras y el
 * body deja de hacer scroll mientras el servicio está activo.
 */
@Injectable({ providedIn: 'root' })
export class AulaInmersivaService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly _activa = signal(false);

  readonly activa = this._activa.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.limpiarBody());
  }

  activar(): void {
    if (this._activa()) return;
    this._activa.set(true);
    if (typeof document !== 'undefined') {
      document.body.classList.add('aula-inmersiva-activa');
    }
  }

  desactivar(): void {
    if (!this._activa()) return;
    this._activa.set(false);
    this.limpiarBody();
  }

  private limpiarBody(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('aula-inmersiva-activa');
    }
  }
}
