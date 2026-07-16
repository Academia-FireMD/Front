import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiBaseService } from './api-base.service';

/** Payload para crear una sala de desafío (duelo). */
export interface CrearDueloDto {
  temas: number[];
  numeroPreguntas: number;
  /** Cronómetro individual de cada participante (minutos). Opcional. */
  tiempoPorTestMin?: number;
  /** Horas que la sala acepta que se unan/compitan antes de cerrar el ranking. */
  duracionSalaHoras?: number;
}

/** Respuesta al crear una sala: código de invitación + test del creador. */
export interface DueloCreadoResponse {
  codigo: string;
  /** Test recién creado para el creador, al que se redirige para jugar. */
  testId: number;
  [key: string]: unknown;
}

/** Respuesta al unirse a una sala: test del participante para redirigir. */
export interface UnirseDueloResponse {
  testId: number;
  codigo?: string;
  [key: string]: unknown;
}

/**
 * Ranking de un duelo. Comparte forma con `ExamenesService.getSimulacroResultados$`
 * para poder reutilizar `ResultadoSimulacroComponent` sin adaptaciones.
 */
export interface RankingDueloUsuario {
  id: number;
  nombre: string;
  apellidos: string;
  esTuResultado: boolean;
  [key: string]: unknown;
}

export interface RankingDueloResultado {
  usuario: RankingDueloUsuario;
  estadisticas: {
    nota: number;
    correctas: number;
    [key: string]: unknown;
  };
  posicion: number;
  testId: number;
  [key: string]: unknown;
}

export interface RankingDueloResponse {
  examen: unknown;
  resultados: RankingDueloResultado[];
  miPosicion: number | null;
  totalParticipantes: number;
  ultimoIntento?: unknown;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class DueloService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/duelos';
  }

  /** Crea una sala de desafío y el test del creador. */
  public crearDuelo$(dto: CrearDueloDto): Observable<DueloCreadoResponse> {
    return this.post('/crear', dto) as Observable<DueloCreadoResponse>;
  }

  /**
   * Se une a una sala por su código. Usa HttpClient directo (no el helper base)
   * para preservar el `HttpErrorResponse` completo (error.error.message) y NO
   * disparar la navegación a /auth en 403 — el error de oposición/lleno/cerrado
   * se muestra inline en el popup, no como toast ni redirección.
   */
  public unirse$(codigo: string): Observable<UnirseDueloResponse> {
    return this.http.post<UnirseDueloResponse>(
      environment.apiUrl +
        this.controllerPrefix +
        '/unirse/' +
        encodeURIComponent(codigo),
      {},
      { withCredentials: true },
    );
  }

  /** Ranking del duelo (misma forma que getSimulacroResultados$). */
  public getRanking$(codigo: string): Observable<RankingDueloResponse> {
    return this.get(
      '/' + encodeURIComponent(codigo) + '/ranking',
    ) as Observable<RankingDueloResponse>;
  }
}
