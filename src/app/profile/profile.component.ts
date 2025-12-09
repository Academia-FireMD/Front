import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { cloneDeep } from 'lodash';
import { Memoize } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { Observable, filter, firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlanificacionesService } from '../services/planificaciones.service';
import {
  MotivoBaja,
  SuscripcionManagementService,
} from '../services/suscripcion-management.service';
import { UserService } from '../services/user.service';
import { ViewportService } from '../services/viewport.service';
import {
  duracionesDisponibles,
} from '../shared/models/pregunta.model';
import { Oposicion, Suscripcion, SuscripcionStatus, SuscripcionTipo } from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import { OnboardingData } from '../shared/onboarding-form/onboarding-form.component';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import {
  selectCurrentUser,
  selectUserError,
  selectUserLoading,
} from '../store/user/user.selectors';
import { oposiciones } from '../utils/consts';
import { BajaSuscripcionComponent } from './baja-suscripcion/baja-suscripcion.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss', './profile-onboarding.component.scss'],
})
export class ProfileComponent implements OnInit {
  // ViewChild para acceder a componentes hijos
  @ViewChild(BajaSuscripcionComponent) bajaSuscripcionComponent?: BajaSuscripcionComponent;

  // Servicios
  private userService = inject(UserService);
  private planificacionService = inject(PlanificacionesService);
  private toastService = inject(ToastrService);
  private store = inject(Store<AppState>);
  private suscripcionManagementService = inject(SuscripcionManagementService);
  viewportService = inject(ViewportService);

  oposiciones = oposiciones;

  // URLs de WordPress desde environment
  tiendaUrl = environment.wooCommerceUrl;
  wordpressUrl = environment.wordpressUrl;

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
  showCambioSuscripcionDialog = false; // Solo para vincular cuenta (usuarios "en negro")
  showBajaSuscripcionDialog = false;   // Solo para usuarios "en negro"

  // Control de subdialogs para baja
  showConfirmacionBaja = false;
  showFueraDePlazoBaja = false;

  // Estados de procesamiento
  procesandoBaja = false;

  // Datos temporales para confirmación
  datosConfirmacionBaja: any = null;
  validacionPlazo: any = null;

  // Enums para los templates
  SuscripcionTipo = SuscripcionTipo;
  Oposicion = Oposicion;

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

  // Helper para obtener la suscripción principal (primera activa)
  private getPrimarySuscripcion() {
    if (!this.user?.suscripciones?.length) return null;
    return this.user.suscripciones.find(s => s.status === SuscripcionStatus.ACTIVE) || this.user.suscripciones[0];
  }

  getSubscriptionEndDate(): string {
    const suscripcion = this.getPrimarySuscripcion();
    if (!suscripcion?.fechaFin) return 'No disponible';

    const endDate = new Date(suscripcion.fechaFin);
    return endDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  getRemainingDays(): number {
    const suscripcion = this.getPrimarySuscripcion();
    if (!suscripcion?.fechaFin) return 0;

    const endDate = new Date(suscripcion.fechaFin);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  getSubscriptionStatusClass(): string {
    const suscripcion = this.getPrimarySuscripcion();
    if (!suscripcion) return 'subscription-status-inactive';

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

  /**
   * Verifica si es el primer acceso y si debe mostrar el modal de onboarding.
   *
   * IMPORTANTE: Los usuarios de WordPress se auto-registran sin datos de onboarding,
   * por lo que este modal es crucial para que completen su perfil.
   */
  private checkFirstTimeAccess(): void {
    if (!this.user) return;
    if (this.user.rol === Rol.ADMIN) return;

    const storageKey = `onboarding_shown_${this.user.id}`;
    const hasSeenOnboarding = localStorage.getItem(storageKey);
    const onboardingComplete = this.isOnboardingComplete();

    // Mostrar modal si:
    // 1. Nunca ha visto el onboarding Y no está completo
    // 2. O si el onboarding está muy incompleto (< 20%) incluso si ya lo vio
    const completionPercentage = this.getOnboardingCompletionPercentage();
    const shouldShowModal = (!hasSeenOnboarding && !onboardingComplete) ||
                           (completionPercentage < 20);

    if (shouldShowModal) {
      setTimeout(() => {
        this.firstTimeShowingOnboardingModal = !hasSeenOnboarding;
        this.showOnboardingModal = true;
      }, 1500);
      // Marcar que ya ha visto el modal de onboarding
      localStorage.setItem(storageKey, 'true');
    }
  }

  navegarACambioSuscripcion(): void {
    // Si el usuario está vinculado a WordPress, redirigir a la tienda
    if (this.isLinkedToWordPress()) {
      this.abrirTiendaWordPress();
      return;
    }

    // Si no está vinculado, mostrar el dialog para vincular cuenta
    this.showCambioSuscripcionDialog = true;
  }

  navegarABajaSuscripcion(): void {
    this.showBajaSuscripcionDialog = true;
  }

  cerrarDialogCambioSuscripcion(): void {
    this.showCambioSuscripcionDialog = false;
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

  onSolicitarVinculacionDesdeDialog(): void {
    // Cerrar el dialog actual
    this.showCambioSuscripcionDialog = false;
    // Iniciar proceso de vinculación
    this.linkToWordPress();
  }


  confirmarBajaDesdePadre(): void {
    if (!this.datosConfirmacionBaja?.motivos) return;

    this.procesandoBaja = true;

    this.suscripcionManagementService
      .solicitarBaja({
        motivos: this.datosConfirmacionBaja.motivos,
        comentarioAdicional: this.datosConfirmacionBaja.comentario || undefined,
        suscripcionId: this.datosConfirmacionBaja.suscripcionId, // ID de la suscripción específica
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
    try {
      // Verificar si tiene suscripción activa de WooCommerce
      // Una suscripción es activa si tiene status ACTIVE y está vinculado a WordPress
      if (!this.user?.woocommerceCustomerId) {
        return false;
      }

      // Si no tiene suscripciones en absoluto, retornar false
      if (!this.user?.suscripciones?.length) {
        return false;
      }

      // Buscar cualquier suscripción activa
      const activeSubscription = this.user.suscripciones.find(s => s.status === SuscripcionStatus.ACTIVE);
      if (!activeSubscription) {
        return false;
      }

      // Verificar también que no haya expirado por fechaFin
      if (activeSubscription.fechaFin) {
        try {
          const endDate = new Date(activeSubscription.fechaFin);
          const today = new Date();
          // Asegurarse de que la fecha es válida
          if (isNaN(endDate.getTime())) {
            console.warn('Fecha de fin de suscripción inválida:', activeSubscription.fechaFin);
            return true; // Si la fecha es inválida, asumir que está activa
          }
          return endDate > today;
        } catch (dateError) {
          console.error('Error al validar fecha de fin:', dateError);
          // En caso de error, asumir que está activa para no bloquear al usuario
          return true;
        }
      }
      return true;
    } catch (error) {
      console.error('Error al verificar suscripción activa:', error);
      // En caso de error, retornar false para mostrar opciones de contratación
      return false;
    }
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
    try {
      if (!this.isLinkedToWordPress()) {
        this.linkToWordPress();
        return;
      }

      // Si está vinculado, redirigir a la tienda de WordPress
      this.abrirTiendaWordPress();
    } catch (error) {
      console.error('Error en handleSubscriptionAction:', error);
      this.toastService.error(
        'Ocurrió un error al procesar la acción. Por favor, intenta de nuevo o contacta con soporte.'
      );
    }
  }

  canUnsubscribe(): boolean {
    return this.isLinkedToWordPress() && this.hasActiveWooCommerceSubscription();
  }

  hasActiveSubscription(): boolean {
    // Verificar si tiene suscripción activa (tanto WooCommerce como "por negro")
    if (!this.user?.suscripciones?.length) {
      return false;
    }

    // Verificar si alguna está activa
    return this.user.suscripciones.some(s => s.status === SuscripcionStatus.ACTIVE);
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

  linkToWordPress(skipConfirmation: boolean = false): void {
    // Si tiene suscripciones locales y no se saltó la confirmación, mostrar advertencia
    if (this.user?.suscripciones?.length && !skipConfirmation) {
      const confirmed = confirm(
        '⚠️ ATENCIÓN: Al vincular tu cuenta con WordPress:\n\n' +
        '• Tus suscripciones actuales en la plataforma serán CANCELADAS\n' +
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

          // Esperar a que el store se actualice con timeout
          try {
            const updatedUser = await firstValueFrom(
              this.user$.pipe(
                filter(user => user !== null && !!user.woocommerceCustomerId),
                // Timeout de 10 segundos
                timeout(10000)
              )
            );
            this.user = cloneDeep(updatedUser);

            // Si no tiene suscripción WP, abrir modal de gestión automáticamente
            if (!this.hasActiveWooCommerceSubscription()) {
              setTimeout(() => {
                this.showCambioSuscripcionDialog = true;
              }, 500);
            }
          } catch (timeoutError) {
            console.error('Timeout esperando actualización del usuario:', timeoutError);
            // Recargar manualmente el usuario como fallback
            this.store.dispatch(UserActions.loadUser());
            this.toastService.warning(
              'La vinculación fue exitosa, pero hay un retraso en la actualización. ' +
              'Por favor, recarga la página o contacta con soporte si el problema persiste.'
            );
            // Intentar abrir el modal de todas formas
            setTimeout(() => {
              this.showCambioSuscripcionDialog = true;
            }, 1000);
          }
        } else {
          this.toastService.warning(
            response.message || 'No se pudo completar la vinculación. Por favor, intenta de nuevo.'
          );
        }
      },
      error: (error) => {
        console.error('Error al vincular con WordPress:', error);

        // Mensajes de error más específicos
        let errorMessage = 'No se pudo vincular la cuenta. ';

        if (error.error?.message) {
          errorMessage += error.error.message;
        } else if (error.status === 0) {
          errorMessage += 'Parece que hay un problema de conexión. Verifica tu internet e intenta de nuevo.';
        } else if (error.status === 404) {
          errorMessage += 'El servicio no está disponible. Por favor, contacta con soporte.';
        } else if (error.status >= 500) {
          errorMessage += 'Hay un problema en el servidor. Por favor, intenta más tarde o contacta con soporte.';
        } else {
          errorMessage += 'Por favor, contacta con soporte si el problema persiste.';
        }

        this.toastService.error(errorMessage);
      },
    });
  }

  // Método para obtener los items del menú de cada suscripción
  @Memoize()
  getSubscriptionMenuItems(suscripcion: Suscripcion) {
    // Usuarios WP: redirigir a WordPress para gestionar
    if (this.isLinkedToWordPress()) {
      return [
        {
          label: 'Gestionar en WordPress',
          icon: 'pi pi-external-link',
          command: () => this.gestionarEnWordPress()
        }
      ];
    }

    // Usuarios "en negro": permitir dar de baja localmente
    return [
      {
        label: 'Dar de baja',
        icon: 'pi pi-sign-out',
        command: () => this.cancelarSuscripcionIndividual(suscripcion)
      }
    ];
  }

  // Abrir página de gestión de suscripciones en WordPress
  gestionarEnWordPress(): void {
    window.open(`${environment.wordpressUrl}/mi-cuenta/subscriptions`, '_blank');
  }

  // Abrir tienda de WordPress
  abrirTiendaWordPress(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  // Método para cancelar una suscripción individual
  cancelarSuscripcionIndividual(suscripcion: Suscripcion): void {
    const confirmed = confirm(
      `¿Estás seguro de que deseas darte de baja de la suscripción "${oposiciones[suscripcion.oposicion]?.name || suscripcion.oposicion}"?\n\n` +
      `• Plan: ${suscripcion.tipo}\n` +
      `• Esta acción no se puede deshacer.\n` +
      `• Perderás acceso al contenido de esta oposición.`
    );

    if (!confirmed) return;

    // Abrir el dialog de baja pasando la suscripción específica
    this.showBajaSuscripcionDialog = true;
    // Almacenamos la suscripción seleccionada para procesarla
    this.datosConfirmacionBaja = {
      suscripcionId: suscripcion.id,
      oposicion: suscripcion.oposicion
    };
  }

  // Genera el tooltip con info de la suscripción
  getSubscriptionTooltip(suscripcion: Suscripcion): string {
    const nombre = oposiciones[suscripcion.oposicion]?.name || suscripcion.oposicion;
    const plan = suscripcion.tipo === 'BASIC' ? 'Básico' : suscripcion.tipo === 'ADVANCED' ? 'Avanzado' : 'Premium';

    let estado = '';
    if (suscripcion.status === 'ACTIVE' && suscripcion.fechaFin) {
      estado = `⏳ Baja pendiente (${new Date(suscripcion.fechaFin).toLocaleDateString('es-ES')})`;
    } else if (suscripcion.status === 'ACTIVE') {
      estado = '✅ Activo';
    } else {
      estado = '❌ Cancelado';
    }

    let tooltip = `${nombre}\n${plan}\n${estado}`;

    if (suscripcion.monthlyPrice) {
      tooltip += `\n💰 ${suscripcion.monthlyPrice}€/mes`;
    }

    return tooltip;
  }
}
