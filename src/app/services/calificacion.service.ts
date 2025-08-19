import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { MetodoCalificacion } from '../shared/models/user.model';
import { UserService } from './user.service';
import { calcularCalificacionPorMetodo } from '../utils/utils';

@Injectable({
  providedIn: 'root'
})
export class CalificacionService {
  private userService = inject(UserService);

  /**
   * Determina el método de calificación a usar según el contexto
   * @param examenMetodo Método especificado en el examen (opcional)
   * @returns Observable con el método de calificación a usar
   */
  getMetodoCalificacion(examenMetodo?: MetodoCalificacion | null): Observable<MetodoCalificacion> {
    // Si el examen tiene un método específico, usarlo
    if (examenMetodo) {
      return of(examenMetodo);
    }

    // Si no, usar la preferencia del usuario
    return this.userService.getUserProfile$().pipe(
      map(user => user?.metodoCalificacion || MetodoCalificacion.A1_E1_3_B0)
    );
  }

  /**
   * Calcula la calificación usando el método apropiado según el contexto
   * @param aciertos Número de aciertos
   * @param errores Número de errores
   * @param totalPreguntas Total de preguntas
   * @param examenMetodo Método especificado en el examen (opcional)
   * @param identificador Identificador opcional para debug
   * @returns Observable con la calificación calculada
   */
  calcularCalificacion(
    aciertos: number,
    errores: number,
    totalPreguntas: number,
    examenMetodo?: MetodoCalificacion | null,
    identificador?: string
  ): Observable<number> {
    return this.getMetodoCalificacion(examenMetodo).pipe(
      map(metodo => calcularCalificacionPorMetodo(
        aciertos,
        errores,
        totalPreguntas,
        metodo,
        identificador
      ))
    );
  }

  /**
   * Versión síncrona para cuando ya sabemos el método a usar
   * @param aciertos Número de aciertos
   * @param errores Número de errores
   * @param totalPreguntas Total de preguntas
   * @param metodo Método de calificación
   * @param identificador Identificador opcional para debug
   * @returns Calificación calculada
   */
  calcularCalificacionSync(
    aciertos: number,
    errores: number,
    totalPreguntas: number,
    metodo: MetodoCalificacion,
    identificador?: string
  ): number {
    return calcularCalificacionPorMetodo(
      aciertos,
      errores,
      totalPreguntas,
      metodo,
      identificador
    );
  }
}
