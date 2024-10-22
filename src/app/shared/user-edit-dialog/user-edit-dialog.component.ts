import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { UserService } from '../../services/user.service';
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
  @Output() editDialogVisibleChange = new EventEmitter<boolean>();
  @Output() confirmarCambios = new EventEmitter<Usuario>();
  users = inject(UserService);
  tutores$ = this.users.getAllTutores$();
}
