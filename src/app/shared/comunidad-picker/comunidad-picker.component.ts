import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Comunidad } from '../models/pregunta.model';
export const comunidadConImagenNombreMap = {
  [Comunidad.MADRID]: {
    image: 'comunidades/MADRID.png',
    name: 'Madrid',
  },
  [Comunidad.VALENCIA]: {
    image: 'comunidades/VLC.png',
    name: 'Valencia',
  },
  [Comunidad.MURCIA]: {
    image: 'comunidades/MURCIA.jpg',
    name: 'Murcia',
  },
} as any;
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
  @Output() updateSelection = new EventEmitter<Comunidad[]>();
  public map = comunidadConImagenNombreMap;
  public keysEnum = Object.keys(Comunidad).map((entry) => {
    return {
      label: comunidadConImagenNombreMap[entry].name,
      code: entry,
      image: comunidadConImagenNombreMap[entry].image,
    };
  });

  public parseOutput = (selection: Array<any>) =>
    this.updateSelection.emit(selection.map((entry) => entry.code));
}
