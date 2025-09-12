import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { cloneDeep } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { Observable, filter, firstValueFrom } from 'rxjs';
import { PlanificacionesService } from '../services/planificaciones.service';
import { UserService } from '../services/user.service';
import { ViewportService } from '../services/viewport.service';
import {
  Comunidad,
  duracionesDisponibles,
} from '../shared/models/pregunta.model';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import { OnboardingData } from '../shared/onboarding-form/onboarding-form.component';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import {
  selectCurrentUser,
  selectUserError,
  selectUserLoading,
} from '../store/user/user.selectors';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss', './profile-onboarding.component.scss'],
})
export class ProfileComponent implements OnInit {
  // Servicios
  private userService = inject(UserService);
  private planificacionService = inject(PlanificacionesService);
  private toastService = inject(ToastrService);
  private store = inject(Store<AppState>);
  viewportService = inject(ViewportService);

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

  // Control del onboarding
  showOnboardingModal = false;
  firstTimeShowingOnboardingModal = false;
  onboardingData: OnboardingData = {};
  public Rol = Rol;

  // Enums para los templates
  SuscripcionTipo = SuscripcionTipo;

  public comunidades = Object.keys(Comunidad).map((entry) => ({
    code: entry,
    name: entry,
    value: entry,
  }));

  constructor() { }

  ngOnInit(): void {
    // Cargar usuario desde el store
    this.store.dispatch(UserActions.loadUser());

    // Suscribirse al usuario del store
    firstValueFrom(this.user$.pipe(filter(user => user !== null))).then((user) => {
      this.user = cloneDeep(user);
      this.loadOnboardingData();

      // Verificar si es primer acceso y abrir modal automáticamente
      this.checkFirstTimeAccess();
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

  private loadOnboardingData() {
    if (!this.user) return;

    // Mapear datos del usuario a formato de onboarding
    this.onboardingData = {
      dni: this.user.dni,
      fechaNacimiento: this.user.fechaNacimiento ? new Date(this.user.fechaNacimiento) : undefined,
      nombreEmpresa: this.user.nombreEmpresa,
      paisRegion: this.user.paisRegion,
      direccionCalle: this.user.direccionCalle,
      codigoPostal: this.user.codigoPostal,
      poblacion: this.user.poblacion,
      provincia: this.user.provincia,
      telefono: this.user.telefono,
      municipioResidencia: this.user.municipioResidencia,
      estudiosPrevaios: this.user.estudiosPrevaios,
      actualTrabajoOcupacion: this.user.actualTrabajoOcupacion,
      hobbies: this.user.hobbies,
      descripcionSemana: this.user.descripcionSemana,
      horasEstudioDiaSemana: this.user.horasEstudioDiaSemana,
      horasEntrenoDiaSemana: this.user.horasEntrenoDiaSemana,
      organizacionEstudioEntreno: this.user.organizacionEstudioEntreno,
      temaPersonal: this.user.temaPersonal,
      oposicionesHechasResultados: this.user.oposicionesHechasResultados,
      pruebasFisicas: this.user.pruebasFisicas,
      tecnicasEstudioUtilizadas: this.user.tecnicasEstudioUtilizadas,
      objetivosSeisMeses: this.user.objetivosSeisMeses,
      objetivosUnAno: this.user.objetivosUnAno,
      experienciaAcademias: this.user.experienciaAcademias,
      queValorasAcademia: this.user.queValorasAcademia,
      queMenosGustaAcademias: this.user.queMenosGustaAcademias,
      queEsperasAcademia: this.user.queEsperasAcademia,
      trabajasActualmente: this.user.trabajasActualmente,
      agotamientoFisicoMental: this.user.agotamientoFisicoMental,
      tiempoDedicableEstudio: this.user.tiempoDedicableEstudio,
      diasSemanaDisponibles: this.user.diasSemanaDisponibles,
      otraInformacionLaboral: this.user.otraInformacionLaboral,
      comentariosAdicionales: this.user.comentariosAdicionales,
      tipoOposicion: this.user.tipoOposicion,
      nivelOposicion: this.user.nivelOposicion,
      tipoDePlanificacionDuracionDeseada: this.user.tipoDePlanificacionDuracionDeseada,
    };
  }

  openOnboardingModal() {
    this.showOnboardingModal = true;
  }

  async onOnboardingUpdated(data: OnboardingData) {
    try {
      await firstValueFrom(this.userService.updateOnboardingData$(data));
      this.toastService.success('Información actualizada correctamente');
      this.showOnboardingModal = false;

      // Actualizar datos locales inmediatamente
      this.onboardingData = { ...data };

      // Recargar usuario
      this.store.dispatch(UserActions.loadUser());
    } catch (error) {
      console.error('Error al actualizar onboarding:', error);
      this.toastService.error('Error al actualizar la información');
    }
  }

  isOnboardingComplete(): boolean {
    if (!this.user) return false;
    return this.user.onboardingCompletado || this.getOnboardingCompletionPercentage() >= 80;
  }

  getOnboardingCompletionPercentage(): number {
    const data = this.onboardingData;
    const fields = Object.values(data);
    const filledFields = fields.filter(value =>
      value !== null && value !== '' && value !== false && value !== undefined
    ).length;
    return Math.round((filledFields / fields.length) * 100);
  }

  isFormPartiallyFilled(): boolean {
    return this.getOnboardingCompletionPercentage() > 0;
  }

  private checkFirstTimeAccess(): void {
    if (!this.user) return;

    const storageKey = `profile_first_access_${this.user.id}`;
    const hasAccessedBefore = localStorage.getItem(storageKey);

    // Si no ha accedido antes y el onboarding no está completo, abrir modal
    if (!hasAccessedBefore && !this.isOnboardingComplete() && this.user.rol !== Rol.ADMIN) {
      setTimeout(() => {
        this.firstTimeShowingOnboardingModal = true;
        this.showOnboardingModal = true;
      }, 2000);
      // Marcar que ya ha accedido al perfil
      localStorage.setItem(storageKey, 'true');
    }
  }
}
