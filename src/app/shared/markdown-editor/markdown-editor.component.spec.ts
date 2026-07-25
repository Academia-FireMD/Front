import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, DomSanitizer, ɵDomSanitizerImpl } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';

/**
 * `@toast-ui/editor` no funciona en jsdom (su `Editor` real no es invocable
 * fuera de un navegador — mismo motivo por el que se mockea en
 * `planificacion-fisica-detalles.component.spec.ts`). Se sustituye por un fake
 * que acumula el markdown insertado y captura las opciones del constructor,
 * suficiente para verificar el CONTRATO: `insertarSnippet` llama a
 * `editor.insertText` con el snippet correcto, y la barra de inserción de
 * recuadros solo se pinta cuando `cursosToolbar` está activo.
 */
const editorInstances: any[] = [];
const editorCtorOpts: any[] = [];

jest.mock('@toast-ui/editor', () => ({
  Editor: jest.fn().mockImplementation((opts: any) => {
    editorCtorOpts.push(opts);
    let markdown: string = opts.initialValue ?? '';
    let selectedText: string = '';
    const instance = {
      getMarkdown: jest.fn(() => markdown),
      setMarkdown: jest.fn((v: string) => {
        markdown = v;
      }),
      insertText: jest.fn((texto: string) => {
        markdown += texto;
        opts.events?.change?.();
      }),
      getSelectedText: jest.fn(() => selectedText),
      replaceSelection: jest.fn((texto: string) => {
        if (selectedText) {
          markdown = markdown.replace(selectedText, texto);
          selectedText = '';
          opts.events?.change?.();
        }
      }),
      destroy: jest.fn(),
      // Auxiliar de test para simular selección
      _setSelectedText: (text: string) => {
        selectedText = text;
      },
    };
    editorInstances.push(instance);
    return instance;
  }),
}));

import {
  MarkdownEditorComponent,
  SnippetClave,
} from './markdown-editor.component';

const CLAVES: SnippetClave[] = [
  'callout--info',
  'callout--exito',
  'callout--aviso',
  'callout--peligro',
  'recuadro',
  'resaltado',
];

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let component: MarkdownEditorComponent;
  let rafSpy: jest.SpyInstance;

  const chips = (): HTMLButtonElement[] =>
    fixture.debugElement
      .queryAll(By.css('.md-insert-bar__chip'))
      .map((de) => de.nativeElement as HTMLButtonElement);

  const chipPorClave = (clave: SnippetClave): HTMLButtonElement =>
    fixture.debugElement.query(By.css(`[data-testid="md-chip-${clave}"]`))
      .nativeElement as HTMLButtonElement;

  beforeEach(async () => {
    editorInstances.length = 0;
    editorCtorOpts.length = 0;
    // El componente difiere la creación del editor a un rAF; en jsdom se
    // ejecuta síncrono para que el editor exista tras detectChanges().
    rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });

    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMarkdown(),
        // El panel de vista previa renderiza con ngx-markdown igual que el
        // alumno; con el DomSanitizer mockeado del repo el HTML se anularía y
        // el test no probaría nada (mismo motivo que en
        // `bloque-render.component.spec.ts`).
        { provide: DomSanitizer, useClass: ɵDomSanitizerImpl },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  it('con cursosToolbar, insertarSnippet añade el callout en el markdown', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    component.insertarSnippet('callout--info');

    const editor = editorInstances[0];
    expect(editor.insertText).toHaveBeenCalledTimes(1);
    expect(editor.getMarkdown()).toContain(
      '<div class="callout callout--info">',
    );
  });

  it('insertarSnippet inserta cada snippet con su clase exacta de _prose.scss', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();
    const editor = editorInstances[0];

    component.insertarSnippet('callout--exito');
    component.insertarSnippet('callout--aviso');
    component.insertarSnippet('callout--peligro');
    component.insertarSnippet('recuadro');
    component.insertarSnippet('resaltado');

    const md = editor.getMarkdown();
    expect(md).toContain('<div class="callout callout--exito">');
    expect(md).toContain('<div class="callout callout--aviso">');
    expect(md).toContain('<div class="callout callout--peligro">');
    expect(md).toContain('<div class="recuadro">');
    expect(md).toContain('<span class="resaltado">');
  });

  it('un recuadro insertado EN MEDIO no rompe el markdown de la línea siguiente', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();
    const editor = editorInstances[0];

    // El admin ya tiene contenido, mete el recuadro en mitad del documento y
    // sigue escribiendo debajo (el fake acumula el texto en orden).
    editor.setMarkdown('Párrafo previo.\n');
    component.insertarSnippet('callout--aviso');
    editor.insertText('# Título justo debajo\n\nY su párrafo.');

    // Un bloque HTML de markdown no termina hasta una línea EN BLANCO: con
    // `</div>\n` el `# Título` quedaba dentro del bloque y se renderizaba como
    // texto literal en vez de como encabezado (QA ronda 2).
    expect(editor.getMarkdown()).toMatch(/<\/div>\n\n# Título justo debajo/);
  });

  it('todos los snippets de bloque cierran con línea en blanco', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();
    const editor = editorInstances[0];

    const bloques: SnippetClave[] = [
      'callout--info',
      'callout--exito',
      'callout--aviso',
      'callout--peligro',
      'recuadro',
    ];
    for (const clave of bloques) {
      editor.setMarkdown('');
      component.insertarSnippet(clave);
      expect(editor.getMarkdown()).toMatch(/<\/div>\n\n$/);
    }

    // `resaltado` es inline (envuelve texto dentro de un párrafo): no debe
    // meter saltos de línea o partiría la frase del alumno.
    editor.setMarkdown('');
    component.insertarSnippet('resaltado');
    expect(editor.getMarkdown()).toBe(
      '<span class="resaltado">texto resaltado</span>',
    );
  });

  it('sin cursosToolbar no se pinta ningún chip de inserción', () => {
    fixture.detectChanges();

    expect(chips().length).toBe(0);
    expect(
      fixture.debugElement.query(By.css('[data-testid="md-insert-bar"]')),
    ).toBeNull();
  });

  // ---- Vista previa fiel (el mismo render que ve el alumno) ----

  const panelPreview = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="md-preview-alumno"]');

  it('con cursosToolbar hay panel de previa propio con el markdown actual', async () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    component.writeValue('# Título de la lección');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = panelPreview();
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain('como lo verá el alumno');
    // Renderizado con ngx-markdown, no texto plano.
    expect(panel!.querySelector('h1')?.textContent).toContain(
      'Título de la lección',
    );
  });

  it('la previa usa el pipeline del alumno: el callout conserva sus clases', async () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    // MISMO markdown que inserta el chip (línea en blanco dentro del div, que
    // es lo que la preview de Toast UI no sabía parsear).
    component.writeValue(
      '<div class="callout callout--info">\n\n**Recuerda.** Interior.\n\n</div>\n\n',
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = panelPreview()!;
    // El contenedor lleva la clase de tipografía del aula: mismos estilos.
    expect(
      panel.querySelector('[data-testid="md-preview-cuerpo"]')!.classList,
    ).toContain('cursos-prose');
    const callout = panel.querySelector('.callout.callout--info');
    expect(callout).not.toBeNull();
    // El markdown de DENTRO del div se procesa (lo que fallaba en Toast UI).
    expect(callout!.querySelector('strong')?.textContent).toContain('Recuerda');
  });

  it('la previa se actualiza en vivo al insertar un recuadro', async () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    chipPorClave('callout--peligro').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      panelPreview()!.querySelector('.callout.callout--peligro'),
    ).not.toBeNull();
  });

  it('con cursosToolbar Toast UI se crea SIN su panel de preview (previewStyle tab)', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    expect(editorCtorOpts[0].previewStyle).toBe('tab');
  });

  it('sin cursosToolbar no hay panel propio y Toast UI conserva su preview', () => {
    fixture.detectChanges();

    expect(panelPreview()).toBeNull();
    expect(editorCtorOpts[0].previewStyle).toBe('vertical');
  });

  it('nunca se pasa toolbarItems: Toast UI conserva su toolbar por defecto', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    expect(editorCtorOpts[0].toolbarItems).toBeUndefined();
  });

  it('con cursosToolbar se pintan los 6 chips con su etiqueta de texto', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const rendered = chips();
    expect(rendered).toHaveLength(6);
    expect(rendered.map((el) => el.getAttribute('data-testid'))).toEqual([
      'md-chip-callout--info',
      'md-chip-callout--exito',
      'md-chip-callout--aviso',
      'md-chip-callout--peligro',
      'md-chip-recuadro',
      'md-chip-resaltado',
    ]);
    // Etiqueta de texto (no solo emoji): es el motivo del cambio.
    expect(rendered.map((el) => el.textContent?.trim())).toEqual([
      expect.stringContaining('Información'),
      expect.stringContaining('Éxito'),
      expect.stringContaining('Aviso'),
      expect.stringContaining('Importante'),
      expect.stringContaining('Recuadro'),
      expect.stringContaining('Resaltar'),
    ]);
    // Todos son type="button" para no enviar el formulario que los envuelve.
    for (const el of rendered) {
      expect(el.getAttribute('type')).toBe('button');
    }
  });

  it('el click en un chip inserta su snippet', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    chipPorClave('callout--peligro').click();

    expect(editorInstances[0].getMarkdown()).toContain(
      '<div class="callout callout--peligro">',
    );
  });

  it('cada chip inserta el snippet de SU clave', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();
    const spy = jest.spyOn(component, 'insertarSnippet');

    for (const clave of CLAVES) {
      chipPorClave(clave).click();
    }

    expect(spy.mock.calls.map(([c]) => c)).toEqual(CLAVES);
  });

  it('cada chip lleva la clase de color de su recuadro', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const modificadores = [
      'info',
      'exito',
      'aviso',
      'peligro',
      'recuadro',
      'resaltado',
    ];
    chips().forEach((el, i) => {
      expect(el.classList).toContain('md-insert-bar__chip');
      expect(el.classList).toContain(
        `md-insert-bar__chip--${modificadores[i]}`,
      );
    });
  });

  it('resaltado envuelve texto seleccionado en <span class="resaltado">...', () => {
    // Recrear componente con inicial value que contiene el texto que será seleccionado
    editorInstances.length = 0;
    editorCtorOpts.length = 0;
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const editor = editorInstances[0] as any;
    // Setear markdown inicial para que contenga la palabra a seleccionar
    editor.setMarkdown('texto con palabra importante aquí');
    // Simular selección de "palabra importante"
    editor._setSelectedText('palabra importante');

    component.insertarSnippet('resaltado');

    expect(editor.replaceSelection).toHaveBeenCalledWith(
      '<span class="resaltado">palabra importante</span>',
    );
    expect(editor.getMarkdown()).toContain(
      '<span class="resaltado">palabra importante</span>',
    );
  });

  it('resaltado inserta placeholder si NO hay selección', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const editor = editorInstances[0] as any;
    // Sin selección (texto vacío)
    editor._setSelectedText('');

    component.insertarSnippet('resaltado');

    // Debe usar insertText, no replaceSelection
    expect(editor.insertText).toHaveBeenCalledWith(
      '<span class="resaltado">texto resaltado</span>',
    );
  });

  it('los chips tienen title descriptivo para accesibilidad', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    for (const el of chips()) {
      expect(el.getAttribute('title')).toBeTruthy();
    }
    expect(chipPorClave('resaltado').getAttribute('title')).toBe(
      'Resaltar el texto seleccionado',
    );
  });
});
