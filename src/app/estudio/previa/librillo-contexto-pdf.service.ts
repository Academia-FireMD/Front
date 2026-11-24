import { Injectable, signal } from '@angular/core';

export interface ContextoPdfLibrillo {
  doc: number;
  revision: string;
  pagina: number;
}

export type PestanaLibrillo = 'lectura' | 'practica' | 'anotaciones';

@Injectable()
export class LibrilloContextoPdfService {
  readonly contexto = signal<ContextoPdfLibrillo | null>(null);
  readonly pestana = signal<PestanaLibrillo>('lectura');
}
