import { Component, EventEmitter, Input, Output } from '@angular/core';
import { oposiciones } from '../../utils/consts';
import { Oposicion } from '../models/subscription.model';

@Component({
  selector: 'app-oposicion-picker',
  templateUrl: './oposicion-picker.component.html',
  styleUrl: './oposicion-picker.component.scss',
})
export class OposicionPickerComponent {
  @Input() oposiciones: Array<Oposicion> = [];
  @Input() allowAdd = false;
  @Input() multiple = true;
  @Output() updateSelection = new EventEmitter<Oposicion[]>();

  public map = oposiciones;
  public keysEnum = Object.values(Oposicion).map((entry) => ({
    label: oposiciones[entry]?.name || entry,
    code: entry,
    icon: oposiciones[entry]?.icon || '📋',
    image: oposiciones[entry]?.image || null,
  }));

  public parseOutput = (selection: Array<any>) =>
    this.updateSelection.emit(selection.map((entry) => entry.code));

  getIcon(oposicion: Oposicion): string {
    return this.map[oposicion]?.icon || '📋';
  }

  getName(oposicion: Oposicion): string {
    return this.map[oposicion]?.name || oposicion;
  }

  getImage(oposicion: Oposicion): string | null {
    return this.map[oposicion]?.image || null;
  }
}

