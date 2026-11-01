import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, finalize, shareReplay } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import {
  CancelarMembresiaExternaPayload,
  CancelarMembresiaExternaResultado,
} from '../shared/models/subscription.model';
import { Usuario } from '../shared/models/user.model';
import { OnboardingData } from '../shared/onboarding-form/onboarding-form.component';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ApiBaseService {
  private profileInFlight$: Observable<Usuario> | null = null;

  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/user';
  }

  public getCurrentUser$(): Observable<Usuario> {
    return this.get('/me') as Observable<Usuario>;
  }

  /**
   * Obtiene el perfil completo del usuario actual, incluyendo suscripción.
   *
   * Single-flight: un refresh de AuthService puede disparar `loadUser` justo
   * cuando el interceptor detecta un 403 de membresía y pide recargar el
   * perfil. Ambas llamadas comparten la misma petición para no duplicar el
   * reload ni pisarse con respuestas fuera de orden.
   */
  public getUserProfile$(): Observable<Usuario> {
    if (this.profileInFlight$) {
      return this.profileInFlight$;
    }

    const request$ = (this.get('/profile') as Observable<Usuario>).pipe(
      finalize(() => {
        this.profileInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.profileInFlight$ = request$;
    return request$;
  }

  public uploadAvatar$(formData: FormData): Observable<Usuario> {
    return this.post('/upload-avatar', formData) as Observable<Usuario>; // Retorna la URL del avatar subido
  }

  public getByEmail$(email: string) {
    return this.post('/get-by-email', { email }) as Observable<Usuario>;
  }

  public getVerifiedUsers$(filter: PaginationFilter) {
    return this.post('/validated', filter) as Observable<
      PaginatedResult<Usuario>
    >;
  }

  public getAllUsers$(filter: PaginationFilter) {
    return this.post('/all', filter) as Observable<PaginatedResult<Usuario>>;
  }

  public getAllTutores$() {
    return this.get('/tutores') as Observable<Usuario[]>;
  }

  // permitirUsuario / denegarUsuario eliminados en Fase 1 (plan 2026-05-11).
  // Los endpoints GET /user/approve/:id y /user/deny/:id devuelven 410 Gone.
  // La baja de usuario se gestiona ahora vía cancelación de suscripción (Fase 2).

  public eliminarUsuario(userId: number) {
    return this.get('/delete/' + userId);
  }

  public updateUser(userId: number, userToUpdate: Partial<Usuario>) {
    return this.post('/update/' + userId, userToUpdate);
  }

  public updateUserSubscription(userId: number, subscriptionType: string) {
    return this.post('/update-subscription/' + userId, { subscriptionType });
  }

  /**
   * Crear o actualizar una suscripción para un usuario con oposición específica
   */
  public createUserSubscription(
    userId: number,
    subscriptionType: string,
    oposicion: string,
  ) {
    return this.post('/create-subscription/' + userId, {
      subscriptionType,
      oposicion,
    });
  }

  /**
   * Cancelar una suscripción específica por ID.
   *
   * No es la baja total: solo afecta a ese plan. La baja de toda la membresía
   * externa se hace con `cancelExternalMembership$`.
   */
  public cancelUserSubscription(subscriptionId: number) {
    return this.post('/cancel-subscription/' + subscriptionId, {});
  }

  /**
   * Baja TOTAL de la membresía externa (solo ADMIN).
   *
   * Cancela de una sola vez todas las suscripciones vigentes EXTERNA de la
   * cuenta. El backend rechaza con 409 GESTION_EXTERNA_REQUERIDA si la cuenta
   * es de WordPress/mixta y conserva cursos independientes, progreso e
   * histórico. Es idempotente.
   *
   * `ignoreError` evita el toast genérico: el diálogo traduce el 409 y los
   * demás errores con copy preciso.
   */
  public cancelExternalMembership$(
    userId: number,
    motivo?: string,
  ): Observable<CancelarMembresiaExternaResultado> {
    const payload: CancelarMembresiaExternaPayload = motivo?.trim()
      ? { motivo: motivo.trim() }
      : {};
    return this.post(
      `/cancel-all-subscriptions/${userId}`,
      payload,
      true,
    ) as Observable<CancelarMembresiaExternaResultado>;
  }

  /**
   * Eliminar una suscripción específica de un usuario (solo admin)
   */
  public deleteUserSubscription(
    userId: number,
    subscriptionId: number,
  ): Observable<Usuario> {
    return this.delete(
      `/subscription/${userId}/${subscriptionId}`,
    ) as Observable<Usuario>;
  }

  public getAvailableSubscriptions() {
    return this.get('/obtain-avaliable-subscriptions');
  }

  public getUsersByPlanification$(planificationId: number) {
    return this.post(`/by-planification/${planificationId}`, {}) as Observable<
      Usuario[]
    >;
  }

  public getUserPlanifications$(userId: number) {
    return this.get(`/planifications/${userId}`) as Observable<any[]>;
  }

  public updateOnboardingData$(data: OnboardingData): Observable<Usuario> {
    return this.post('/update-onboarding', data) as Observable<Usuario>;
  }
}
