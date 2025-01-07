export interface Documento {
  id: number;
  identificador: string;
  descripcion?: string; // Este campo es opcional
  url: string; // URL donde se hospeda el documento
  esPublico: boolean; // Indica si es público o privado
  usuarioId?: number; // ID del usuario al que está asignado (opcional)
  creadoPorId: number; // ID del usuario que creó el documento
  creadoEn: Date; // Fecha de creación
  actualizadoEn: Date; // Fecha de última actualización
}
