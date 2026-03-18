import { Provider } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, ElementRef, NgZone } from '@angular/core';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

// PrimeNG
import { PrimeNGConfig } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';

// Third-party
import { ToastrService } from 'ngx-toastr';

// App services
import { AppInitializationService } from '../services/app-initialization.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { TestService } from '../services/test.service';
import { TemaService } from '../services/tema.service';
import { PreguntasService } from '../services/preguntas.service';
import { ViewportService } from '../services/viewport.service';
import { PlanificacionesService } from '../services/planificaciones.service';
import { FlashcardDataService } from '../services/flashcards.service';
import { ReportesFalloService } from '../services/reporte-fallo.service';
import { FactorsService } from '../services/factors.service';
import { SuscripcionManagementService } from '../services/suscripcion-management.service';
import { ExamenesService } from '../examen/servicios/examen.service';
import { EventsService } from '../planificacion/services/events.service';
import { ModuloService } from '../shared/services/modulo.service';
import { LabelsService } from '../shared/services/labels.service';
import { DocumentosService } from '../documentacion/services/documentacion.service';
import { FacturacionService } from '../facturacion/servicios/facturacion.service';

const mockStore = {
  dispatch: jest.fn(),
  select: jest.fn(() => of(null)),
  pipe: jest.fn(() => of(null)),
};

const mockActivatedRoute = {
  snapshot: { params: {}, queryParams: {}, data: {}, paramMap: { get: jest.fn() } },
  params: of({}),
  queryParams: of({}),
  data: of({}),
  paramMap: of({ get: jest.fn() }),
  parent: { params: of({}) },
};

const mockRouter = {
  navigate: jest.fn(),
  navigateByUrl: jest.fn(),
  events: of(),
  url: '/',
  createUrlTree: jest.fn(),
  serializeUrl: jest.fn(() => ''),
};

function mockService(): Record<string, jest.Mock> {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop === 'string' && prop !== 'then') {
        return jest.fn(() => of(null));
      }
      return undefined;
    },
  }) as Record<string, jest.Mock>;
}

export const COMMON_TEST_PROVIDERS: Provider[] = [
  FormBuilder,
  { provide: Router, useValue: mockRouter },
  { provide: ActivatedRoute, useValue: mockActivatedRoute },
  { provide: Location, useValue: { back: jest.fn(), path: jest.fn(() => '') } },
  { provide: DomSanitizer, useValue: { bypassSecurityTrustResourceUrl: jest.fn(), sanitize: jest.fn() } },
  { provide: HttpClient, useValue: mockService() },
  { provide: ChangeDetectorRef, useValue: { detectChanges: jest.fn(), markForCheck: jest.fn() } },
  { provide: Store, useValue: mockStore },
  { provide: PrimeNGConfig, useValue: { ripple: false, setTranslation: jest.fn() } },
  { provide: ConfirmationService, useValue: { confirm: jest.fn(), close: jest.fn() } },
  { provide: ToastrService, useValue: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } },
  { provide: AppInitializationService, useValue: mockService() },
  { provide: AuthService, useValue: mockService() },
  { provide: UserService, useValue: mockService() },
  { provide: TestService, useValue: mockService() },
  { provide: TemaService, useValue: mockService() },
  { provide: PreguntasService, useValue: mockService() },
  { provide: ViewportService, useValue: { isMobile: jest.fn(() => false), isMobile$: of(false) } },
  { provide: PlanificacionesService, useValue: mockService() },
  { provide: FlashcardDataService, useValue: mockService() },
  { provide: ReportesFalloService, useValue: mockService() },
  { provide: FactorsService, useValue: mockService() },
  { provide: SuscripcionManagementService, useValue: mockService() },
  { provide: ExamenesService, useValue: mockService() },
  { provide: EventsService, useValue: mockService() },
  { provide: ModuloService, useValue: mockService() },
  { provide: LabelsService, useValue: mockService() },
  { provide: DocumentosService, useValue: mockService() },
  { provide: FacturacionService, useValue: mockService() },
];
