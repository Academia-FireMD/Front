import { HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { AiAssistantWidgetComponent } from './ai-assistant-widget.component';

describe('AiAssistantWidgetComponent', () => {
  let httpGet: jest.Mock;

  function setup() {
    httpGet = jest.fn();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AiAssistantWidgetComponent],
      providers: [
        { provide: HttpClient, useValue: { get: httpGet } },
        {
          provide: AuthService,
          useValue: { decodeToken: () => ({ rol: 'ALUMNO' }) },
        },
      ],
    });
    return TestBed.createComponent(AiAssistantWidgetComponent)
      .componentInstance;
  }

  function forbidden(reason?: string) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 403,
          error: reason ? { reason } : {},
        }),
    );
  }

  it('muestra el upsell cuando el acceso se deniega por TIER_TOO_LOW', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('TIER_TOO_LOW'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.showUpsell()).toBe(true);
  });

  it('NO muestra upsell con NO_SUBSCRIPTION (oculto en silencio)', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('NO_SUBSCRIPTION'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.showUpsell()).toBe(false);
  });

  it('NO muestra upsell con EXPIRED (oculto en silencio)', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('EXPIRED'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.showUpsell()).toBe(false);
  });

  it('NO muestra upsell cuando el token se obtiene OK', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(of({ token: 'jwt' }));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.showUpsell()).toBe(false);
    cmp.ngOnDestroy();
  });
});
