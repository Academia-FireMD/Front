import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-key',
  templateUrl: './key.component.html',
  styleUrl: './key.component.scss',
  standalone: true,
})
export class KeyComponent {
  @Input() keyName: string = '';
}
