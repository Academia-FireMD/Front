export type EstadoCurso = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';

export type TipoLeccion = 'VIDEO' | 'TEST' | 'FLASHCARDS' | 'TEXTO';

export interface Leccion {
  id: number;
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  testPlantillaId?: number;
  mazoFlashcardsId?: number;
  contenidoMarkdown?: string;
  seccionId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Seccion {
  id: number;
  titulo: string;
  orden: number;
  cursoId: number;
  lecciones: Leccion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Curso {
  id: number;
  titulo: string;
  slug: string;
  descripcion?: string;
  precio?: number;
  oposicion?: Record<string, unknown>;
  thumbnailUrl?: string;
  duracionEstimadaMinutos?: number;
  estado: EstadoCurso;
  createdAt?: string;
  updatedAt?: string;
}

export interface CursoAdmin extends Curso {
  _count?: { secciones?: number; accesos?: number };
}

export interface CursoDetail extends Curso {
  secciones: Seccion[];
}

export interface TusCredentials {
  endpoint: string;
  VideoId: string;
  LibraryId: string;
  AuthorizationSignature: string;
  AuthorizationExpire: number;
}

export interface SeccionReorderItem {
  id: number;
  orden: number;
}

export interface LeccionReorderItem {
  id: number;
  orden: number;
}
