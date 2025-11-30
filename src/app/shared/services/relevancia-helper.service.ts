import { Injectable, inject } from '@angular/core';
import { FormArray, FormControl } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { Comunidad } from '../models/pregunta.model';
import { Rol } from '../models/user.model';
import { AppState } from '../../store/app.state';
import { selectCurrentUser } from '../../store/user/user.selectors';

export interface RelevanciaPreseleccionada {
  comunidad: Comunidad;
  esPreseleccionada: boolean;
}

/**
 * Clase helper que encapsula la lógica de preselección de relevancia
 * para evitar duplicación de código en los componentes
 */
export class RelevanciaPreseleccionHelper {
  public isRelevanciaPreseleccionada = false;

  constructor(
    private relevanciaFormArray: FormArray,
    private helperService: RelevanciaHelperService
  ) {}

  /**
   * Preselecciona la relevancia según el rol del usuario
   * @param isNewItem Indica si es un nuevo item
   */
  async preseleccionar(isNewItem: boolean): Promise<void> {
    this.isRelevanciaPreseleccionada = await this.helperService.aplicarPreseleccionRelevancia(
      this.relevanciaFormArray,
      isNewItem
    );
  }

  /**
   * Actualiza la selección de comunidades (resetea el flag de preselección)
   * @param communities Array de comunidades seleccionadas
   */
  actualizarSeleccion(communities: Comunidad[]): void {
    this.isRelevanciaPreseleccionada = this.helperService.actualizarSeleccionComunidades(
      this.relevanciaFormArray,
      communities
    );
  }

  /**
   * Marca la relevancia existente como preseleccionada (para edición)
   * @param comunidades Array de comunidades existentes
   */
  async marcarComoPreseleccionada(comunidades: Comunidad[]): Promise<void> {
    if (comunidades && comunidades.length > 0) {
      const user = await firstValueFrom(this.helperService.store.select(selectCurrentUser));
      // Solo marcar como preseleccionada si es admin
      if (user && user.rol === Rol.ADMIN) {
        this.isRelevanciaPreseleccionada = true;
      }
    }
  }

  /**
   * Carga la relevancia existente en el FormArray y la marca como preseleccionada si corresponde
   * @param comunidades Array de comunidades existentes
   */
  async cargarRelevanciaExistente(comunidades: Comunidad[]): Promise<void> {
    this.relevanciaFormArray.clear();
    if (comunidades && comunidades.length > 0) {
      comunidades.forEach((comunidad) =>
        this.relevanciaFormArray.push(new FormControl(comunidad))
      );
      await this.marcarComoPreseleccionada(comunidades);
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class RelevanciaHelperService {
  store = inject(Store<AppState>);

  /**
   * Crea una instancia del helper de preselección de relevancia
   * @param relevanciaFormArray FormArray de relevancia
   * @returns Instancia del helper
   */
  crearHelper(relevanciaFormArray: FormArray): RelevanciaPreseleccionHelper {
    return new RelevanciaPreseleccionHelper(relevanciaFormArray, this);
  }

  /**
   * Obtiene la relevancia preseleccionada según el rol del usuario
   * @param isNewItem Indica si es un nuevo item (no editando uno existente)
   * @returns Promise con la comunidad preseleccionada o null
   */
  async obtenerRelevanciaPreseleccionada(isNewItem: boolean): Promise<RelevanciaPreseleccionada | null> {
    if (!isNewItem) {
      return null; // No preseleccionar si es edición
    }

    const user = await firstValueFrom(this.store.select(selectCurrentUser));
    
    if (!user) {
      return null;
    }

    if (user.rol === Rol.ALUMNO && user.comunidad) {
      // Si es alumno, usar su comunidad
      return {
        comunidad: user.comunidad,
        esPreseleccionada: true
      };
    } else if (user.rol === Rol.ADMIN) {
      // Si es admin, preseleccionar Valencia
      return {
        comunidad: Comunidad.VALENCIA,
        esPreseleccionada: true
      };
    }

    return null;
  }

  /**
   * Aplica la preselección de relevancia al FormArray y retorna si está preseleccionada
   * @param relevanciaFormArray FormArray de relevancia
   * @param isNewItem Indica si es un nuevo item
   * @returns Promise con true si se aplicó preselección, false en caso contrario
   */
  async aplicarPreseleccionRelevancia(
    relevanciaFormArray: FormArray,
    isNewItem: boolean
  ): Promise<boolean> {
    const relevanciaData = await this.obtenerRelevanciaPreseleccionada(isNewItem);
    
    if (relevanciaData) {
      relevanciaFormArray.clear();
      relevanciaFormArray.push(new FormControl(relevanciaData.comunidad));
      return relevanciaData.esPreseleccionada;
    }
    
    return false;
  }

  /**
   * Actualiza la selección de comunidades en el FormArray y resetea el flag de preselección
   * @param relevanciaFormArray FormArray de relevancia
   * @param communities Array de comunidades seleccionadas
   * @returns false (indica que ya no está preseleccionada)
   */
  actualizarSeleccionComunidades(
    relevanciaFormArray: FormArray,
    communities: Comunidad[]
  ): boolean {
    relevanciaFormArray.clear();
    communities.forEach((code) => relevanciaFormArray.push(new FormControl(code)));
    return false; // Ya no está preseleccionada después de modificación manual
  }
}

