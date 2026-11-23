export const LIMITE_ELIMINACION_MASIVA = 5_000;

export interface RevisionEliminacionMasiva {
  tamanoPagina: number;
  temas: {
    id: number;
    numero: string;
    descripcion: string | null;
    seleccionadas: number;
    restantes: number;
  }[];
  entradas: {
    id: number;
    identificador: string;
    descripcion: string;
    temaNumero: string;
  }[];
}
