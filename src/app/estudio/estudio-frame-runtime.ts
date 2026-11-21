export type EstadoEstudio =
  | 'loading'
  | 'ready'
  | 'saving'
  | 'pending'
  | 'saved'
  | 'offline'
  | 'error'
  | 'limited';
export type CanalEstudio = 'progreso' | 'reto';

export interface RespuestaPuente {
  status: number;
  result: unknown;
}

export interface ConfigFrame {
  origin: string;
  instance: string;
  drafts: Record<string, string>;
}
