import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface PuntoPdf {
  x: number;
  y: number;
}

export interface RectanguloPdf extends PuntoPdf {
  ancho: number;
  alto: number;
}

export interface SubrayadoPdf {
  id: string;
  color: string;
  fragmento?: string;
  rectangulos: RectanguloPdf[];
}

export interface TrazoPdf {
  id: string;
  color: string;
  grosor: number;
  puntos: PuntoPdf[];
}

export interface PaginaPdf {
  nota: string;
  subrayados: SubrayadoPdf[];
  trazos: TrazoPdf[];
  aparte: TrazoPdf[];
}

export const PAGINA_PDF_VACIA: PaginaPdf = {
  nota: '',
  subrayados: [],
  trazos: [],
  aparte: [],
};

export type TipoReferenciaPdf =
  | 'PREGUNTA'
  | 'TARJETA'
  | 'SUGERIDO'
  | 'HUECO'
  | 'DATO'
  | 'TRAMPA';

export interface ReferenciaPdf {
  id: number;
  revision: string;
  pagina: number;
  tipo: TipoReferenciaPdf;
  estado: 'borrador' | 'publicada';
  rectangulos: RectanguloPdf[];
  texto?: string;
  color?: string;
  preguntaId?: number;
  flashcardId?: number;
}

export interface PartePdf {
  pagina: number;
  version: number;
  valor: PaginaPdf;
  conflicto?: true;
}

export interface EdicionPdf {
  doc: number;
  revision: string;
}

interface GuardadoPdf {
  generacion: number;
  partes: PartePdf[];
}

@Injectable({ providedIn: 'root' })
export class LibrilloPdfApiService {
  private readonly http = inject(HttpClient);

  abrir(edicion: EdicionPdf) {
    return this.http.get<
      GuardadoPdf & {
        revision: string;
        paginas: number;
        referencias: ReferenciaPdf[];
      }
    >(this.url(edicion.doc), { params: { revision: edicion.revision } });
  }

  guardar(
    edicion: EdicionPdf,
    generacion: number,
    partes: Array<{ pagina: number; base: number; valor: PaginaPdf }>,
  ) {
    return this.http.post<GuardadoPdf>(this.url(edicion.doc) + '/anotaciones', {
      revision: edicion.revision,
      generacion,
      partes,
    });
  }

  importar(
    edicion: EdicionPdf,
    generacion: number,
    lote: string,
    partes: Array<{ pagina: number; valor: PaginaPdf }>,
  ) {
    return this.http.post<GuardadoPdf>(this.url(edicion.doc) + '/importar', {
      revision: edicion.revision,
      generacion,
      lote,
      partes,
    });
  }

  reiniciar(edicion: EdicionPdf, generacion: number) {
    return this.http.post<{ generacion: number }>(
      this.url(edicion.doc) + '/reiniciar',
      {
        revision: edicion.revision,
        generacion,
      },
    );
  }

  editor(edicion: EdicionPdf) {
    return this.http.get<{
      revision: string;
      paginas: number;
      referencias: ReferenciaPdf[];
    }>(this.url(edicion.doc) + '/editor', {
      params: { revision: edicion.revision },
    });
  }

  guardarReferencia(
    edicion: EdicionPdf,
    referencia: Omit<ReferenciaPdf, 'id' | 'revision'> & { id?: number },
  ) {
    return this.http.post<ReferenciaPdf>(this.url(edicion.doc) + '/editor', {
      ...referencia,
      revision: edicion.revision,
    });
  }

  quitarReferencia(edicion: EdicionPdf, id: number) {
    return this.http.delete<void>(this.url(edicion.doc) + '/editor/' + id, {
      params: { revision: edicion.revision },
    });
  }

  sugerir(
    edicion: EdicionPdf,
    pagina: number,
    fragmento: string,
    rectangulos: RectanguloPdf[],
  ) {
    return this.http.post<ReferenciaPdf>(
      this.url(edicion.doc) + '/editor/sugerir',
      {
        revision: edicion.revision,
        pagina,
        fragmento,
        rectangulos,
      },
    );
  }

  crearMaterial<T>(
    temaId: number,
    tipo: 'test' | 'flashcards',
    material: {
      descripcion: string;
      solucion: string;
      respuestas?: string[];
      respuestaCorrectaIndex?: number;
    },
  ) {
    return this.http.post<T>(
      environment.apiUrl +
        '/librillos/temas/' +
        temaId +
        '/practica/personal/' +
        tipo,
      material,
    );
  }

  private url(doc: number) {
    return environment.apiUrl + '/documentos/' + doc + '/librillo/pdf';
  }
}
