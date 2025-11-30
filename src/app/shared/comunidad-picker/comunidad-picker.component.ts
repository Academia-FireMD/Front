import { Component, EventEmitter, Input, Output } from '@angular/core';
import { comunidades } from '../../utils/consts';
import { Comunidad } from '../models/pregunta.model';

@Component({
  selector: 'app-comunidad-picker',
  templateUrl: './comunidad-picker.component.html',
  styleUrl: './comunidad-picker.component.scss',
})
export class ComunidadPickerComponent {
  @Input() comunidades: Array<Comunidad> = [
    Comunidad.MADRID,
    Comunidad.VALENCIA,
    Comunidad.MURCIA,
  ];
  @Input() allowAdd = false;
  @Input() preseleccionada = false; // Indica si la relevancia está preseleccionada
  @Output() updateSelection = new EventEmitter<Comunidad[]>();
  public map = comunidades;
  public keysEnum = Object.keys(Comunidad).map((entry) => {
    return {
      label: this.map[entry].name,
      code: entry,
      image: this.map[entry].image,
    };
  });

  public parseOutput = (selection: Array<any>) =>
    this.updateSelection.emit(selection.map((entry) => entry.code));
}
