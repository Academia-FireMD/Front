import { ComponentFixture, TestBed } from '@angular/core/testing';

/**
 * `@toast-ui/editor` no funciona en jsdom (su `Editor` real no es invocable
 * fuera de un navegador — mismo motivo por el que se mockea en
 * `planificacion-fisica-detalles.component.spec.ts`). Se sustituye por un fake
 * que acumula el markdown insertado y captura las opciones del constructor,
 * suficiente para verificar el CONTRATO: `insertarSnippet` llama a
 * `editor.insertText` con el snippet correcto, y la toolbar extra solo se
 * registra cuando `cursosToolbar` está activo.
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

import { MarkdownEditorComponent } from './markdown-editor.component';

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let component: MarkdownEditorComponent;
  let rafSpy: jest.SpyInstance;

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

  it('sin cursosToolbar no se registran botones extra', () => {
    fixture.detectChanges();

    expect(component.extraToolbarItems().length).toBe(0);
    // Y el editor se construye con la config por defecto (sin toolbarItems).
    expect(editorCtorOpts[0].toolbarItems).toBeUndefined();
  });

  it('con cursosToolbar, el editor recibe la toolbar por defecto + grupo custom final', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const toolbarItems = editorCtorOpts[0].toolbarItems;
    expect(Array.isArray(toolbarItems)).toBe(true);
    // Grupos por defecto de Toast UI v3 + el grupo custom al final.
    expect(toolbarItems[0]).toEqual(['heading', 'bold', 'italic', 'strike']);
    const grupoCustom = toolbarItems[toolbarItems.length - 1];
    expect(grupoCustom).toHaveLength(6);
    for (const item of grupoCustom) {
      expect(item.el).toBeInstanceOf(HTMLButtonElement);
      expect(typeof item.name).toBe('string');
      expect(typeof item.tooltip).toBe('string');
    }
  });

  it('el click en un botón custom inserta su snippet', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const grupoCustom =
      editorCtorOpts[0].toolbarItems[editorCtorOpts[0].toolbarItems.length - 1];
    const btnPeligro = grupoCustom.find(
      (i: any) => i.name === 'callout--peligro',
    );
    btnPeligro.el.dispatchEvent(new Event('click'));

    expect(editorInstances[0].getMarkdown()).toContain(
      '<div class="callout callout--peligro">',
    );
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

  it('botones custom tienen title para accesibilidad', () => {
    fixture.componentRef.setInput('cursosToolbar', true);
    fixture.detectChanges();

    const grupoCustom =
      editorCtorOpts[0].toolbarItems[editorCtorOpts[0].toolbarItems.length - 1];
    for (const item of grupoCustom) {
      expect(item.el.getAttribute('title')).toBe(item.tooltip);
    }
  });
});
