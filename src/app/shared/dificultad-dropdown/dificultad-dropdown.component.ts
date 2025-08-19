import { Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { getAllDifficultades } from '../../utils/utils';
import { selectUserRol } from '../../store/user/user.selectors';

@Component({
  selector: 'app-dificultad-dropdown',
  templateUrl: './dificultad-dropdown.component.html',
  styleUrl: './dificultad-dropdown.component.scss',
})
export class DificultadDropdownComponent {
  @Input() formControlDificultad!: any;
  @Input() isDoingTest = false;
  @Input() customOptions: Array<any> = [];
  @Input() isGrouped: boolean = false;
  @Input() isFlashcards = false;
  
  public getAllDifficultades = getAllDifficultades;

  constructor(private store: Store) {
  }

  get optionsToUse() {
    // Si hay opciones personalizadas, usarlas directamente
    if (this.customOptions.length > 0) {
      return this.customOptions;
    }

    // Obtener el rol del store
    const currentRol = this.store.selectSignal(selectUserRol);

    // Obtener opciones basadas en el rol y parámetros
    const options = getAllDifficultades(
      this.isFlashcards, 
      this.isDoingTest, 
      currentRol()
    );

    // Auto-detect grouping if items exist (solo para opciones agrupadas)
    const looksGrouped =
      Array.isArray(options) && 
      options.length > 0 && 
      'items' in options[0] && 
      Array.isArray((options[0] as any).items);
    
    this.isGrouped = this.isGrouped || looksGrouped;
    
    return options;
  }
}
