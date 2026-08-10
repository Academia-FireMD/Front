import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Usuario, UsuarioAdministrativo } from '../shared/models/user.model';
import { OnboardingData } from '../shared/onboarding-form/onboarding-form.component';
import { AsignacionAdministrativa } from '../shared/models/planificacion.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/user';
  }

  public getCurrentUser$(): Observable<Usuario> {
    return this.get('/me') as Observable<Usuario>;
  }

  /**
   * Obtiene el perfil completo del usuario actual, incluyendo suscripción
   */
  public getUserProfile$(): Observable<Usuario> {
    return this.get('/profile') as Observable<Usuario>;
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

  public getAdminUserDetail$(id: number): Observable<UsuarioAdministrativo> {
    // El 404 del detalle es un estado de UI ("El usuario ya no existe"), no un
    // error que deba tragarse ni disparar toast genérico. `ApiBaseService.get`
    // con `ignoreError` omite el toast; aquí se RE-EMITE el HttpErrorResponse
    // original para que `UserDetailComponent` pueda distinguir 404 de 5xx
    // (`error?.status`), cosa que el `Error` plano de `handleError` no permite.
    return this.get(`/admin/${id}`, true).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err)),
    );
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
   * Cancelar una suscripción específica por ID
   */
  public cancelUserSubscription(subscriptionId: number) {
    return this.post('/cancel-subscription/' + subscriptionId, {});
  }

  /**
   * Eliminar una suscripción específica de un usuario (solo admin)
   */
  public deleteUserSubscription(
    userId: number,
    subscriptionId: number,
  ): Observable<UsuarioAdministrativo> {
    return this.delete(
      `/subscription/${userId}/${subscriptionId}`,
    ) as Observable<UsuarioAdministrativo>;
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
    return this.get(`/planifications/${userId}`) as Observable<
      AsignacionAdministrativa[]
    >;
  }

  public updateOnboardingData$(data: OnboardingData): Observable<Usuario> {
    return this.post('/update-onboarding', data) as Observable<Usuario>;
  }
}
