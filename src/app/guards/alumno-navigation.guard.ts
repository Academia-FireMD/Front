import { CanDeactivateFn } from '@angular/router';
export interface VistaAlumnoConOperacion {
  prepararSalida(): boolean | Promise<boolean>;
}
/** Descarta borradores; una operación ya confirmada termina antes de abandonar su contexto. */
export const alumnoNavigationGuard: CanDeactivateFn<VistaAlumnoConOperacion> = (
  component,
) => component.prepararSalida();
