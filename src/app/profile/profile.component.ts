import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { cloneDeep } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { Observable, filter, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlanificacionesService } from '../services/planificaciones.service';
import {
  MotivoBaja,
  SuscripcionManagementService,
} from '../services/suscripcion-management.service';
import { UserService } from '../services/user.service';
import { ViewportService } from '../services/viewport.service';
import {
  Comunidad,
  duracionesDisponibles,
} from '../shared/models/pregunta.model';
import { SuscripcionStatus, SuscripcionTipo } from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import { OnboardingData } from '../shared/onboarding-form/onboarding-form.component';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import {
  selectCurrentUser,
  selectUserError,
  selectUserLoading,
} from '../store/user/user.selectors';
import { BajaSuscripcionComponent } from './baja-suscripcion/baja-suscripcion.component';
import { CambioSuscripcionComponent } from './cambio-suscripcion/cambio-suscripcion.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss', './profile-onboarding.component.scss'],
})
export class ProfileComponent implements OnInit {
  // ViewChild para acceder a componentes hijos
  @ViewChild(CambioSuscripcionComponent) cambioSuscripcionComponent?: CambioSuscripcionComponent;
  @ViewChild(BajaSuscripcionComponent) bajaSuscripcionComponent?: BajaSuscripcionComponent;

  // Servicios
  private userService = inject(UserService);
  private planificacionService = inject(PlanificacionesService);
  private toastService = inject(ToastrService);
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private suscripcionManagementService = inject(SuscripcionManagementService);
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

  // Control de dialogs de suscripción
  showCambioSuscripcionDialog = false;
  showBajaSuscripcionDialog = false;

  // Control de subdialogs
  showConfirmacionCambio = false;
  showConfirmacionBaja = false;
  showFueraDePlazoCambio = false;
  showFueraDePlazoBaja = false;

  // Estados de procesamiento
  procesandoCambio = false;
  procesandoBaja = false;

  // Datos temporales para confirmación
  datosConfirmacionCambio: any = null;
  datosConfirmacionBaja: any = null;
  validacionPlazo: any = null;

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
          dni: this.user.dni,
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

  navegarACambioSuscripcion(): void {
    this.showCambioSuscripcionDialog = true;
  }

  navegarABajaSuscripcion(): void {
    this.showBajaSuscripcionDialog = true;
  }

  cerrarDialogCambioSuscripcion(): void {
    this.showCambioSuscripcionDialog = false;
    this.showConfirmacionCambio = false;
    this.showFueraDePlazoCambio = false;
    this.datosConfirmacionCambio = null;
    this.validacionPlazo = null;
    this.procesandoCambio = false;
    // Recargar usuario por si cambió algo
    this.store.dispatch(UserActions.loadUser());
  }

  cerrarDialogBajaSuscripcion(): void {
    this.showBajaSuscripcionDialog = false;
    this.showConfirmacionBaja = false;
    this.showFueraDePlazoBaja = false;
    this.datosConfirmacionBaja = null;
    this.validacionPlazo = null;
    this.procesandoBaja = false;
    // Recargar usuario por si cambió algo
    this.store.dispatch(UserActions.loadUser());
  }

  // Eventos de cambio de suscripción
  onSolicitarConfirmacionCambio(datos: any): void {
    this.datosConfirmacionCambio = datos;
    this.showConfirmacionCambio = true;
  }

  onFueraDePlazoCambio(validacion: any): void {
    this.validacionPlazo = validacion;
    this.showFueraDePlazoCambio = true;
  }

  cerrarFueraDePlazoCambio(): void {
    this.showFueraDePlazoCambio = false;
    this.validacionPlazo = null;
    this.cerrarDialogCambioSuscripcion();
  }

  confirmarCambioDesdePadre(): void {
    if (!this.datosConfirmacionCambio?.planSeleccionado) return;

    this.procesandoCambio = true;

    this.suscripcionManagementService
      .cambiarSuscripcion({
        nuevoSkuProducto: this.datosConfirmacionCambio.planSeleccionado.sku,
        comentario: this.datosConfirmacionCambio.comentario || undefined,
      })
      .subscribe({
        next: (response) => {
          this.procesandoCambio = false;
          this.showConfirmacionCambio = false;
          this.toastService.success(response.mensaje || 'Cambio de suscripción procesado correctamente');
          this.cerrarDialogCambioSuscripcion();
          // Recargar usuario
          this.store.dispatch(UserActions.loadUser());
        },
        error: (error) => {
          this.procesandoCambio = false;
          this.toastService.error(
            error.error?.message || 'No se pudo procesar el cambio de suscripción'
          );
        },
      });
  }

  confirmarBajaDesdePadre(): void {
    if (!this.datosConfirmacionBaja?.motivos) return;

    this.procesandoBaja = true;

    this.suscripcionManagementService
      .solicitarBaja({
        motivos: this.datosConfirmacionBaja.motivos,
        comentarioAdicional: this.datosConfirmacionBaja.comentario || undefined,
      })
      .subscribe({
        next: (response) => {
          this.procesandoBaja = false;
          this.showConfirmacionBaja = false;
          this.toastService.success(response.mensaje || 'Baja de suscripción procesada correctamente');
          this.cerrarDialogBajaSuscripcion();
          // Recargar usuario
          this.store.dispatch(UserActions.loadUser());
        },
        error: (error) => {
          this.procesandoBaja = false;
          this.toastService.error(
            error.error?.message || 'No se pudo procesar la solicitud de baja'
          );
        },
      });
  }

  // Eventos de baja de suscripción
  onSolicitarConfirmacionBaja(datos: any): void {
    this.datosConfirmacionBaja = datos;
    this.showConfirmacionBaja = true;
  }

  onFueraDePlazoBaja(validacion: any): void {
    this.validacionPlazo = validacion;
    this.showFueraDePlazoBaja = true;
  }

  cerrarFueraDePlazoBaja(): void {
    this.showFueraDePlazoBaja = false;
    this.validacionPlazo = null;
    this.cerrarDialogBajaSuscripcion();
  }

  isLinkedToWordPress(): boolean {
    return !!this.user?.woocommerceCustomerId;
  }

  hasActiveWooCommerceSubscription(): boolean {
    // Verificar si tiene suscripción activa de WooCommerce
    // Una suscripción es activa si tiene status ACTIVE y está vinculado a WordPress
    if (!this.user?.suscripcion || !this.user?.woocommerceCustomerId) {
      return false;
    }

    const subscription = this.user.suscripcion;

    // Verificar por status
    if (subscription.status === SuscripcionStatus.ACTIVE) {
      // Verificar también que no haya expirado por fechaFin
      if (subscription.fechaFin) {
        const endDate = new Date(subscription.fechaFin);
        const today = new Date();
        return endDate > today;
      }
      return true;
    }

    return false;
  }

  getSubscriptionButtonLabel(): string {
    if (!this.isLinkedToWordPress()) {
      return 'Vincular con WordPress';
    }

    if (!this.hasActiveWooCommerceSubscription()) {
      return 'Obtener plan';
    }

    return 'Cambiar plan';
  }

  getSubscriptionButtonIcon(): string {
    if (!this.isLinkedToWordPress()) {
      return 'pi pi-link';
    }

    if (!this.hasActiveWooCommerceSubscription()) {
      return 'pi pi-shopping-cart';
    }

    return 'pi pi-sync';
  }

  handleSubscriptionAction(): void {
    if (!this.isLinkedToWordPress()) {
      this.linkToWordPress();
      return;
    }

    if (!this.hasActiveWooCommerceSubscription()) {
      // Redirigir a página de WooCommerce para contratar
      this.obtenerPlan();
      return;
    }

    // Ya tiene suscripción, puede cambiar
    this.navegarACambioSuscripcion();
  }

  obtenerPlan(): void {
    const wooCommerceUrl = environment.wooCommerceUrl;
    window.open(wooCommerceUrl, '_blank');

    this.toastService.info('Serás redirigido a nuestra tienda para seleccionar tu plan');
  }

  canUnsubscribe(): boolean {
    return this.isLinkedToWordPress() && this.hasActiveWooCommerceSubscription();
  }

  getMotivoLabel(motivo: MotivoBaja): string {
    const motivosMap: { [key: string]: string } = {
      [MotivoBaja.APROBADO]: '🧑‍🚒 Ya he aprobado la oposición',
      [MotivoBaja.CAMBIO_ACADEMIA]: '🔄 He decidido cambiar de academia',
      [MotivoBaja.PREPARACION_PROPIA]: '💪 Voy a prepararlo por mi cuenta',
      [MotivoBaja.TRATO_NO_COMODO]: '🤝 No me he sentido cómodo/a con el trato recibido',
      [MotivoBaja.MATERIAL_INADECUADO]: '📚 El material no me ha resultado suficiente o adecuado',
      [MotivoBaja.FALTA_TIEMPO]: '🕒 No dispongo del tiempo necesario',
      [MotivoBaja.MOTIVOS_ECONOMICOS]: '💰 Motivos económicos o personales',
      [MotivoBaja.OTROS]: '❓ Otros motivos',
    };
    return motivosMap[motivo] || motivo;
  }

  linkToWordPress(): void {
    // Si tiene suscripción local, mostrar advertencia
    if (this.user?.suscripcion) {
      const confirmed = confirm(
        '⚠️ ATENCIÓN: Al vincular tu cuenta con WordPress:\n\n' +
        '• Tu suscripción actual en la plataforma será CANCELADA\n' +
        '• Deberás contratar un nuevo plan a través de WooCommerce\n' +
        '• Tus datos y progreso se mantendrán intactos\n\n' +
        '¿Estás seguro de que deseas continuar?'
      );

      if (!confirmed) return;
    }

    this.toastService.info('Vinculando tu cuenta con WordPress...');

    this.suscripcionManagementService.linkToWordPress().subscribe({
      next: async (response) => {
        if (response.success) {
          this.toastService.success(
            response.message || 'Cuenta vinculada exitosamente.'
          );

          // Recargar datos del usuario desde el store
          this.store.dispatch(UserActions.loadUser());

          // Esperar a que el store se actualice y actualizar el usuario local
          const updatedUser = await firstValueFrom(
            this.user$.pipe(filter(user => user !== null && !!user.woocommerceCustomerId))
          );
          this.user = cloneDeep(updatedUser);

          // Si no tiene suscripción WP, mostrar mensaje
          if (!this.hasActiveWooCommerceSubscription()) {
            setTimeout(() => {
              alert(
                '✅ Vinculación exitosa!\n\n' +
                'Para completar el proceso, necesitas contratar un plan.\n' +
                'Haz clic en "Obtener plan" para ver las opciones disponibles.'
              );
            }, 1000);
          }
        } else {
          this.toastService.warning(response.message);
        }
      },
      error: (error) => {
        console.error('Error al vincular con WordPress:', error);
        this.toastService.error(
          'No se pudo vincular la cuenta. Por favor, contacta con soporte.'
        );
      },
    });
  }
}
