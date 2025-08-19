import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { Observable, catchError, filter, firstValueFrom, of, tap } from 'rxjs';
import { PlanificacionesService } from '../services/planificaciones.service';
import { UserService } from '../services/user.service';
import {
  Comunidad,
  duracionesDisponibles,
} from '../shared/models/pregunta.model';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { Usuario } from '../shared/models/user.model';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import {
  selectCurrentUser,
  selectUserLoading,
  selectUserError,
} from '../store/user/user.selectors';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  // Servicios
  private userService = inject(UserService);
  private planificacionService = inject(PlanificacionesService);
  private toastService = inject(ToastrService);
  private store = inject(Store<AppState>);

  // Propiedades del store
  user$ = this.store.select(selectCurrentUser);
  isLoading$ = this.store.select(selectUserLoading);
  error$ = this.store.select(selectUserError);

  // Propiedades locales
  user: Usuario | null = null;
  isSaving = false;
  errors: string[] = [];
  tutores$: Observable<Usuario[]> = this.userService.getAllTutores$();
  duracionesDisponibles = duracionesDisponibles;
  countPlanificacionesAsignadas$ =
    this.planificacionService.getInfoPlanificacionesAsignadas();

  // Enums para los templates
  SuscripcionTipo = SuscripcionTipo;

  public comunidades = Object.keys(Comunidad).map((entry) => ({
    code: entry,
    name: entry,
    value: entry,
  }));

  constructor() {}

  ngOnInit(): void {
    // Cargar usuario desde el store
    this.store.dispatch(UserActions.loadUser());

    // Suscribirse al usuario del store
    firstValueFrom(this.user$.pipe(filter(user => user !== null))).then((user) => {
      this.user = cloneDeep(user);
    });

    

    // Manejar errores
    this.error$.subscribe((error) => {
      if (error) {
        this.errors.push('Error al cargar el perfil: ' + error);
        this.toastService.error('Error al cargar el perfil');
      }
    });
  }

  async saveProfile(): Promise<void> {
    if (!this.user) return;

    this.isSaving = true;

    // Dispatch action para actualizar usuario en el store
    this.store.dispatch(
      UserActions.updateUser({
        userId: this.user.id,
        userData: {
          nombre: this.user.nombre,
          apellidos: this.user.apellidos,
          comunidad: this.user.comunidad,
          tutorId: this.user.tutorId,
          tipoDePlanificacionDuracionDeseada:
            this.user.tipoDePlanificacionDuracionDeseada,
          metodoCalificacion: this.user.metodoCalificacion,
          esTutor: this.user.esTutor,
        },
      })
    );

    // Escuchar el resultado de la actualización
    this.isLoading$.subscribe((loading) => {
      if (!loading && this.isSaving) {
        this.isSaving = false;
        this.toastService.success('Perfil actualizado correctamente');
      }
    });

    this.error$.subscribe((error) => {
      if (error && this.isSaving) {
        this.isSaving = false;
        this.errors.push('Error al guardar el perfil: ' + error);
        this.toastService.error('Error al guardar el perfil');
      }
    });
  }

  async autoAssignPlanificacion(): Promise<void> {
    if (!this.user) return;

    try {
      await firstValueFrom(
        this.planificacionService.autoAssignPlanificacionMensual(
          this.user.tipoDePlanificacionDuracionDeseada
        )
      );
      this.toastService.success(
        'Planificación por defecto asignada automáticamente'
      );

      // Recargar planificaciones asignadas
      this.countPlanificacionesAsignadas$ =
        this.planificacionService.getInfoPlanificacionesAsignadas();
    } catch (error: any) {
      this.errors.push('Error al asignar planificación: ' + error.message);
      this.toastService.error('Error al asignar planificación');
    }
  }

  getSubscriptionEndDate(): string {
    if (!this.user?.suscripcion?.fechaFin) return 'No disponible';

    const endDate = new Date(this.user.suscripcion.fechaFin);
    return endDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  getRemainingDays(): number {
    if (!this.user?.suscripcion?.fechaFin) return 0;

    const endDate = new Date(this.user.suscripcion.fechaFin);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  getSubscriptionStatusClass(): string {
    if (!this.user?.suscripcion) return 'subscription-status-inactive';

    const remainingDays = this.getRemainingDays();
    if (remainingDays <= 0) return 'subscription-status-expired';
    if (remainingDays <= 7) return 'subscription-status-warning';
    return 'subscription-status-active';
  }
}
