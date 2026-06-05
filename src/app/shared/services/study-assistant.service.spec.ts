import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { StudyAssistantService } from './study-assistant.service';

describe('StudyAssistantService', () => {
  let service: StudyAssistantService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudyAssistantService);
    doc = TestBed.inject(DOCUMENT);
    doc.body.innerHTML = `
      <div id="ai-widget-panel"></div>
      <input id="ai-widget-input" />
      <button id="ai-widget-send"></button>`;
  });

  it('abre el panel, escribe el mensaje y dispara enviar', () => {
    const send = doc.getElementById('ai-widget-send')!;
    const clickSpy = jest.spyOn(send, 'click');
    const ok = service.openWithMessage('hola');
    expect(ok).toBe(true);
    expect(
      doc.getElementById('ai-widget-panel')!.classList.contains('open'),
    ).toBe(true);
    expect(
      (doc.getElementById('ai-widget-input') as HTMLInputElement).value,
    ).toBe('hola');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('devuelve false si el widget no está montado', () => {
    doc.body.innerHTML = '';
    expect(service.openWithMessage('hola')).toBe(false);
  });
});
