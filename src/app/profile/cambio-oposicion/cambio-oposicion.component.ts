import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { SuscripcionesService } from '../../services/suscripciones.service';
import { Oposicion } from '../../shared/models/subscription.model';
import { AppState } from '../../store/app.state';
import * as UserActions from '../../store/user/user.actions';
import { oposiciones } from '../../utils/consts';

interface SuscripcionData {
  id: number;
  tipo: string;
  oposicion: Oposicion;
  isGeneric?: boolean;  // Opcional para compatibilidad con Suscripcion
  status: string;
}

@Component({
  selector: 'app-cambio-oposicion',
  templateUrl: './cambio-oposicion.component.html',
  styleUrls: ['./cambio-oposicion.component.scss']
})
export class CambioOposicionComponent implements OnInit {
  private suscripcionesService = inject(SuscripcionesService);
  private toastService = inject(ToastrService);
  private store = inject(Store<AppState>);

  @Input() suscripcion!: SuscripcionData;
  @Output() onClose = new EventEmitter<{ changed: boolean }>();

  oposicionSeleccionada?: Oposicion;
  oposiciones = oposiciones;
  oposicionesDisponibles: Oposicion[] = [];

  // Estados
  cargando = false;
  cambiando = false;
  puedeRealizarCambio = false;
  razonNoPuede?: string;
  diasRestantes?: number;

  ngOnInit() {
    if (!this.suscripcion) {
      this.toastService.error('No se encontró información de la suscripción');
      this.onClose.emit({ changed: false });
      return;
    }

    // Verificar si puede realizar el cambio
    // El backend nos dirá qué oposiciones están disponibles
    this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    this.cargando = true;
    try {
      const response = await this.suscripcionesService
        .puedeRealizarCambio(this.suscripcion.id)
        .toPromise();

      if (response) {
        this.puedeRealizarCambio = response.puede;
        this.razonNoPuede = response.razon;
        this.diasRestantes = response.diasRestantes;

        // Si hay oposiciones disponibles específicas, usarlas
        if (response.oposicionesDisponibles && response.oposicionesDisponibles.length > 0) {
          this.oposicionesDisponibles = response.oposicionesDisponibles;
        }
      }
    } catch (error: any) {
      console.error('Error verificando elegibilidad:', error);
      this.toastService.error(error?.error?.message || 'Error al verificar elegibilidad');
      this.puedeRealizarCambio = false;
    } finally {
      this.cargando = false;
    }
  }

  async confirmarCambio() {
    if (!this.oposicionSeleccionada) {
      this.toastService.warning('Selecciona una oposición');
      return;
    }

    this.cambiando = true;

    try {
      const response = await this.suscripcionesService
        .cambiarOposicion(this.suscripcion.id, this.oposicionSeleccionada)
        .toPromise();

      if (response?.success) {
        this.toastService.success(response.mensaje || 'Oposición cambiada exitosamente');

        // Recargar datos del usuario
        this.store.dispatch(UserActions.loadUser());

        this.onClose.emit({ changed: true });
      }
    } catch (error: any) {
      console.error('Error cambiando oposición:', error);
      this.toastService.error(
        error?.error?.message || 'Error al cambiar de oposición'
      );
    } finally {
      this.cambiando = false;
    }
  }

  cancelar() {
    this.onClose.emit({ changed: false });
  }

  getOposicionNombre(oposicion: Oposicion): string {
    return this.oposiciones[oposicion]?.name || oposicion;
  }

  getOposicionImagen(oposicion: Oposicion): string {
    return this.oposiciones[oposicion]?.image || '';
  }
}

