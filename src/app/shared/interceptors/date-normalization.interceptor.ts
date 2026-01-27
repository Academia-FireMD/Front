import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class DateNormalizationInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // No procesar FormData (multipart/form-data)
    if (req.body instanceof FormData) {
      return next.handle(req);
    }

    // Solo procesar POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const normalizedBody = this.normalizeDates(req.body);
      
      // Solo clonar si hubo cambios
      if (normalizedBody !== req.body) {
        req = req.clone({ body: normalizedBody });
      }
    }

    return next.handle(req);
  }

  private normalizeDates(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (obj instanceof Date) {
      return this.toISOStringWithTimezone(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeDates(item));
    }

    if (typeof obj === 'object') {
      const normalized: any = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          if (value instanceof Date) {
            normalized[key] = this.toISOStringWithTimezone(value);
          }
          else if (value !== null && typeof value === 'object') {
            normalized[key] = this.normalizeDates(value);
          }
          else {
            normalized[key] = value;
          }
        }
      }
      
      return normalized;
    }

    return obj;
  }

  /**
   * Convierte un Date a formato ISO 8601 CON offset del timezone local
   * 
   * Ejemplo: Usuario en España (UTC+1) selecciona "14 enero 2026, 10:30"
   * - Resultado: "2026-01-14T10:30:00.000+01:00"
   * - El backend automáticamente lo interpretará como 09:30 UTC
   * - UX: El usuario piensa en su hora local, todo funciona transparente
   */
  private toISOStringWithTimezone(date: Date): string {
    const tzOffset = -date.getTimezoneOffset(); // Offset en minutos (ej: España = +60)
    const sign = tzOffset >= 0 ? '+' : '-';
    const absOffset = Math.abs(tzOffset);
    const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const minutes = String(absOffset % 60).padStart(2, '0');
    
    // Obtener componentes de la fecha en hora local del navegador
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    
    // Formato estándar ISO 8601: 2026-01-14T10:30:00.000+01:00
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${sign}${hours}:${minutes}`;
  }
}

