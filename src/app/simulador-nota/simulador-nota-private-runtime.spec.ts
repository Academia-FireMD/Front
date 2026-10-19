import {
  makeValidSnapshot,
  makeValidWireState,
} from './testing/simulador-nota-fixtures';

describe('runtime del iframe privado del simulador', () => {
  it('emite un solo DELETE y ningún change durante el repintado síncrono del reset', () => {
    const readFile = jest.requireActual('node:fs').readFileSync as (
      path: string,
      encoding: string,
    ) => string;
    const source = readFile(
      'public/simulador-nota/index.html',
      'utf8',
    );
    const iframe = document.createElement('iframe');
    iframe.src = `${window.location.origin}/simulador-nota/index.html?modo=privado`;
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) throw new Error('No se pudo crear el contexto iframe.');
    const mensajes: Array<{ data: unknown; targetOrigin: string }> = [];
    const postMessageSpy = jest
      .spyOn(window, 'postMessage')
      .mockImplementation((data, targetOrigin) => {
        mensajes.push({ data, targetOrigin: String(targetOrigin) });
      });

    try {
      iframeWindow.document.open();
      iframeWindow.document.write(source);
      iframeWindow.document.close();
      const ChildEvent = (iframeWindow as unknown as { Event: typeof Event })
        .Event;
      iframeWindow.document.dispatchEvent(
        new ChildEvent('DOMContentLoaded', { bubbles: true }),
      );

      const snapshot = {
        ...makeValidSnapshot(),
        actual: makeValidWireState('cv', 'consorcio'),
      };
      iframeWindow.dispatchEvent(
        new MessageEvent('message', {
          data: {
            channel: 'tkf-simulador-nota-v1',
            type: 'hydrate',
            revision: 7,
            estado: snapshot,
          },
          origin: window.location.origin,
          source: window,
        }),
      );

      const reset = iframeWindow.document
        .querySelector('[data-tkf-simulador]')
        ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-el="reset"]');
      expect(reset).toBeTruthy();
      expect(reset?.hidden).toBe(false);

      mensajes.length = 0;
      reset?.click();
      reset?.click();

      expect(
        mensajes
          .map(({ data }) => data as { channel?: string; type?: string })
          .filter((data) => data.channel === 'tkf-simulador-nota-v1')
          .map((data) => data.type),
      ).toEqual(['delete']);
      expect(mensajes[0].targetOrigin).toBe(window.location.origin);
    } finally {
      postMessageSpy.mockRestore();
      iframe.remove();
    }
  });
});
