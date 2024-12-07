import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { UserService } from '../../services/user.service';
import { comunidadConImagenNombreMap } from '../comunidad-picker/comunidad-picker.component';
import { Comunidad, duracionesDisponibles } from '../models/pregunta.model';
import { Usuario } from '../models/user.model';

@Component({
  selector: 'app-user-edit-dialog',
  templateUrl: './user-edit-dialog.component.html',
  styleUrl: './user-edit-dialog.component.scss',
})
export class UserEditDialogComponent {
  @Input() selectedUser!: Usuario;
  @Input() editDialogVisible = false;
  @Input() allowSetIsTutor = true;
  @Input() rol: 'ADMIN' | 'ALUMNO' = 'ADMIN';
  @Output() editDialogVisibleChange = new EventEmitter<boolean>();
  @Output() confirmarCambios = new EventEmitter<Usuario>();
  users = inject(UserService);
  planificacionService = inject(PlanificacionesService);
  toastService = inject(ToastrService);
  countPlanificacionesAsignadas$ =
    this.planificacionService.getInfoPlanificacionesAsignadas();
  tutores$ = this.users.getAllTutores$();
  duracionesDisponibles = duracionesDisponibles;
  public comunidades = Object.keys(Comunidad).map((entry) => {
    return {
      code: entry,
      ...comunidadConImagenNombreMap[entry],
    };
  });

  public async autoAssignPlanificacion() {
    try {
      await firstValueFrom(
        this.planificacionService.autoAssignPlanificacionMensual(
          this.selectedUser.tipoDePlanificacionDuracionDeseada
        )
      );
      this.toastService.success(
        'Planificación por defecto asignada automaticamente!'
      );
      this.confirmarCambios.emit(this.selectedUser);
    } catch (error) {}
  }
}
