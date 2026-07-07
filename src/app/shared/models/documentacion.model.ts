export interface Documento {
  id: number;
  identificador: string;
  fileName?: string | null;
  descripcion?: string; // Este campo es opcional
  url: string; // URL donde se hospeda el documento
  esPublico: boolean; // Indica si es público o privado
  usuarioId?: number; // ID del usuario al que está asignado (opcional)
  creadoPorId: number; // ID del usuario que creó el documento
  creadoEn: Date; // Fecha de creación
  actualizadoEn: Date; // Fecha de última actualización
  temaId?: number;
  tema?: { id: number; numero: number | string; descripcion?: string };
  isLocked?: boolean;
  requireWatermark?: boolean;
  // Señal de gestión (admin): ¿está cubierto por una Release activa y por tanto
  // visible para los alumnos? Lo calcula el backend en /documentos/publicos.
  isPublicado?: boolean;
}
