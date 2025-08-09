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
  @Input() isDoingTest = false;
  @Input() customOptions: Array<any> = [];
  @Input() isGrouped: boolean = false;
  public rolEnum = Rol;
  public getAllDifficultades = getAllDifficultades;

  get optionsToUse() {
    const options = this.customOptions.length > 0
      ? this.customOptions
      : getAllDifficultades(false, this.isDoingTest);
    // Auto-detect grouping if items exist
    const looksGrouped = Array.isArray(options) && options.length > 0 && !!options[0]?.items;
    this.isGrouped = this.isGrouped || looksGrouped;
    return options;
  }
}
