import { Component, inject } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { AppInitializationService } from './services/app-initialization.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'Front';
  private appInitService = inject(AppInitializationService);

  constructor(private primengConfig: PrimeNGConfig) {}

  ngOnInit() {
    this.primengConfig.ripple = true;
    this.appInitService.initializeApp();
  }
}
