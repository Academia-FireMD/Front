import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import { PaginatedResult, PaginationFilter } from '../../shared/models/pagination.model';
import { Pregunta } from '../../shared/models/pregunta.model';
import { Examen } from '../models/examen.model';
@Injectable({
  providedIn: 'root',
})
export class ExamenesService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/examenes';
  }

  public anyadirPreguntasAcademia$(examenId: number): Observable<any> {
    return this.post(`/${examenId}/anyadir-preguntas-academia`, {}) as Observable<any>;
  }

  public nextPregunta(examenId: string, preguntaId: string): Observable<Pregunta> {
    return this.get(`/next/${examenId}/${preguntaId}`) as Observable<Pregunta>;
  }

  public prevPregunta(examenId: string, preguntaId: string): Observable<Pregunta> {
    return this.get(`/prev/${examenId}/${preguntaId}`) as Observable<Pregunta>;
  }

  public nextPreguntaForward(examenId: string, preguntaId: string): Observable<Pregunta> {
    return this.get(`/next-forward/${examenId}/${preguntaId}`) as Observable<Pregunta>;
  }

  public prevPreguntaForward(examenId: string, preguntaId: string): Observable<Pregunta> {
    return this.get(`/prev-forward/${examenId}/${preguntaId}`) as Observable<Pregunta>;
  }


  public updatePreguntaReservaStatus$(
    examenId: number,
    preguntaId: number,
    esReserva: boolean
  ): Observable<any> {
    return this.put(`/${examenId}/preguntas/${preguntaId}/reserva`, { esReserva }) as Observable<any>;
  }

  // Métodos para administradores
  public getExamenes$(
    pagination: PaginationFilter
  ): Observable<PaginatedResult<Examen>> {
    return this.post('/listar', pagination) as Observable<PaginatedResult<Examen>>;
  }

  public getExamenById$(id: number): Observable<Examen> {
    return this.get(`/${id}`) as Observable<Examen>;
  }

  public getSimulacroById$(id: number): Observable<Examen> {
    return this.get(`/simulacro/${id}`) as Observable<Examen>;
  }

  public getSimulacroResultados$(idExamen: number): Observable<any> {
    return this.get(`/simulacro/${idExamen}/resultados`);
  }

  public createExamen$(examen: any): Observable<Examen> {
    return this.post('/crear', examen) as Observable<Examen>;
  }

  public updateExamen$(id: number, examen: any): Observable<Examen> {
    return this.put(`/${id}`, examen) as Observable<Examen>;
  }

  public deleteExamen$(id: number): Observable<any> {
    return this.delete(`/${id}`) as Observable<any>;
  }

  public publicarExamen$(id: number): Observable<Examen> {
    return this.post(`/${id}/publicar`, {}) as Observable<Examen>;
  }

  public archivarExamen$(id: number): Observable<Examen> {
    return this.post(`/${id}/archivar`, {}) as Observable<Examen>;
  }

  public addPreguntasToExamen$(
    examenId: number,
    preguntaIds: number[],
    esReserva: boolean = false
  ): Observable<any> {
    return this.post(`/${examenId}/preguntas`, {
      preguntaIds,
      esReserva
    }) as Observable<any>;
  }



  public removePreguntasFromExamen$(
    examenId: number,
    preguntaIds: number[]
  ): Observable<any> {
    return this.post(`/${examenId}/eliminar-preguntas`, {
      preguntaIds,
    }) as Observable<any>;
  }

  // Métodos para alumnos
  public getExamenesDisponibles$(
    pagination: PaginationFilter
  ): Observable<PaginatedResult<Examen>> {
    return this.post('/disponibles', pagination) as Observable<PaginatedResult<Examen>>;
  }



  public startExamen$(examenId: number): Observable<any> {
    return this.post(`/iniciar/${examenId}`, {}) as Observable<any>;
  }

  public getProgresoExamenColaborativo$(examenId: number): Observable<any> {
    return this.get(`/colaborativo/${examenId}/progreso`) as Observable<any>;
  }

  public getExamenesColaborativosActivos$(): Observable<any[]> {
    return this.get('/colaborativos-activos') as Observable<any[]>;
  }


  public updatePreguntasOrder$(examenId: number, preguntaIds: number[]) {
    return this.put(`/${examenId}/preguntas/order`, {
      preguntaIds
    }) as Observable<any>;
  }



  public downloadExamenWithFilename$(id: number, examenName: string, conSoluciones: boolean = false): Observable<{ blob: Blob, filename: string }> {
    return this.http.get(`${environment.apiUrl}${this.controllerPrefix}/download-word/${id}?conSoluciones=${conSoluciones}`, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      map(response => {
        // Extraer el nombre del archivo del header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition') || '';

        // Asegurarse de que el nombre del archivo esté correctamente formateado para HTTP
        const safeFilename = examenName.replace(/ /g, '_').toLowerCase();
        let filename = `${safeFilename}_${conSoluciones ? 'con_soluciones_' : ''}${+new Date()}.docx`;

        // Intentar extraer el nombre del archivo con diferentes patrones
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
          // Decodificar el nombre del archivo si está codificado
          try {
            filename = decodeURIComponent(filename);
          } catch (e) {
            console.warn('Error al decodificar el nombre del archivo', e);
          }
        }


        return {
          blob: response.body as Blob,
          filename: filename
        };
      })
    );
  }

  /**
   * Verifica el código de acceso para un simulacro
   * @param examenId ID del examen
   * @param codigo Código de acceso
   * @returns Observable<boolean> True si el código es válido
   */
  public verificarCodigoAcceso$(examenId: number, codigo: string): Observable<boolean> {
    return this.post(`/verificar-codigo/${examenId}`, { codigo });
  }

  /**
   * Inicia un examen con código de acceso
   * @param examenId ID del examen
   * @param codigo Código de acceso (opcional)
   * @returns Observable con el test creado
   */
  public startSimulacro$(examenId: number, codigo?: string): Observable<any> {
    return this.post(`/start-simulacro/${examenId}`, { codigo });
  }

  public impugnarPregunta$(examenId: number, preguntaId: number, impugnada: boolean, motivoImpugnacion?: string) {
    return this.post(`/${examenId}/preguntas/${preguntaId}/impugnar`, {
      impugnada,
      motivoImpugnacion
    });
  }

  public impugnarPreguntaDesdeTest$(testId: number, preguntaId: number, motivoImpugnacion: string) {
    return this.post(`/tests/${testId}/preguntas/${preguntaId}/impugnar`, {
      motivoImpugnacion
    });
  }

  public getExamenesRealizados$(pagination: PaginationFilter): Observable<PaginatedResult<any>> {
    return this.post('/realizados', pagination) as Observable<PaginatedResult<any>>;
  }

  /**
   * Obtiene las preguntas colaborativas creadas por los alumnos para un examen
   * @param examenId ID del examen
   * @returns Observable con las preguntas colaborativas
   */
  public getPreguntasColaborativas$(examenId: number): Observable<any[]> {
    return this.get(`/${examenId}/preguntas-colaborativas`) as Observable<any[]>;
  }

  /**
   * Obtiene productos de WooCommerce que son simulacros
   * @returns Observable con la lista de productos simulacro
   */
  public getWooCommerceSimulacros$(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/woocommerce/products/simulacros`);
  }

  /**
   * Verifica si el usuario tiene acceso a un simulacro por consumible
   * @param examenId ID del examen
   * @returns Observable con información de acceso
   */
  public verificarAccesoSimulacro$(examenId: number): Observable<{
    tieneAcceso: boolean;
    necesitaCodigo: boolean;
    consumible?: any;
    examen?: any;
  }> {
    return this.get(`/verificar-acceso-simulacro/${examenId}`) as Observable<any>;
  }

  /**
   * Busca un simulacro por SKU (sin consumir)
   * @param sku SKU del producto WooCommerce
   * @returns Observable con el examen encontrado
   */
  public buscarSimulacroPorSku$(sku: string): Observable<{
    examen: { id: number; titulo: string; descripcion: string; duracion: number; codigoAcceso?: string };
    consumible: { id: number; sku: string };
    message: string;
  }> {
    return this.post('/buscar-simulacro-por-sku', { sku }) as Observable<any>;
  }
}
