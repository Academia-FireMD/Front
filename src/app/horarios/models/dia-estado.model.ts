export interface DiaEstado {
  fecha: Date;
  estado: 'disponible' | 'parcial' | 'completo' | 'sin-datos';
}
