import { Component, Input } from '@angular/core';
import { getAllDifficultades } from '../../utils/utils';
import { Rol } from '../models/user.model';

@Component({
  selector: 'app-dificultad-dropdown',
  templateUrl: './dificultad-dropdown.component.html',
  styleUrl: './dificultad-dropdown.component.scss',
})
export class DificultadDropdownComponent {
  @Input() rol: Rol = Rol.ADMIN;
  @Input() formControlDificultad!: any;
  public rolEnum = Rol;
  public getAllDifficultades = getAllDifficultades;
}
