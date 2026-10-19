export interface SimuladorNotaGuardada {
  id: string;
  nombre: string;
  fecha: string;
  origen: 'propia' | 'importada';
  estado: Record<string, unknown>;
}

export interface SimuladorNotaSnapshot {
  v: 1;
  actual: Record<string, unknown> | null;
  guardadas: SimuladorNotaGuardada[];
  tab: string | null;
  plazas: Record<string, number>;
}

export interface SimuladorNotaVersion {
  revision: number;
  estado: SimuladorNotaSnapshot | null;
  actualizadoEn: string | null;
}
