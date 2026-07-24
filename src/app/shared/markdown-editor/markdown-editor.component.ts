import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  Input,
  input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { universalEditorConfig } from '../../utils/utils';

/** Claves de los snippets de la toolbar de cursos (clases de `_prose.scss`). */
export type SnippetClave =
  | 'callout--info'
  | 'callout--exito'
  | 'callout--aviso'
  | 'callout--peligro'
  | 'recuadro'
  | 'resaltado';

/** Item custom de toolbar de Toast UI v3 (`{ el, name, tooltip }`). */
interface ToolbarCustomItem {
  el: HTMLElement;
  name: string;
  tooltip: string;
}

/**
 * Editor Markdown con preview en vivo al lado (Toast UI Editor), envuelto como
 * ControlValueAccessor para usarlo con `formControlName`/`ngModel`. Reutiliza la
 * MISMA config base (`universalEditorConfig`) que la definición de
 * preguntas/flashcards, así el contenido de bloques de texto se edita igual
 * que el resto del proyecto. `previewStyle` (default `vertical`, igual que
 * `universalEditorConfig`) permite que un consumidor concreto pida el modo
 * `tab` de Toast UI (pestañas Write/Preview) en vez del split lateral
 * permanente — pensado para contenedores estrechos.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: `<div #host class="markdown-editor-host"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class MarkdownEditorComponent
  implements AfterViewInit, OnDestroy, ControlValueAccessor
{
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Input() height = '300px';
  /**
   * `vertical` (default, sin cambios) = Write/Preview partidos en dos columnas
   * permanentes, bien cuando el editor tiene ancho completo. `tab` = pestañas
   * nativas de Toast UI (Write/Preview, una vista visible a la vez) — pensado
   * para tarjetas estrechas (p.ej. varias por fila) donde el split lateral
   * queda apretado. NO cambia el default global (`universalEditorConfig`
   * sigue siendo `vertical` para el resto de editores de la app).
   */
  @Input() previewStyle: 'vertical' | 'tab' = 'vertical';
  /**
   * Activa un grupo extra de botones en la toolbar para insertar los snippets
   * de callout/resaltado/recuadro de las lecciones de cursos (clases CSS de
   * `cursos/ui/_prose.scss`), para que el profe no escriba HTML a mano.
   * Default `false`: el resto de consumidores del editor (preguntas,
   * flashcards, planificación física) no cambian.
   */
  cursosToolbar = input(false);

  /**
   * Toolbar por defecto de Toast UI v3. Hay que replicarla porque pasar
   * `toolbarItems` al constructor REEMPLAZA el default — solo se usa cuando
   * `cursosToolbar` añade el grupo custom; sin él no se pasa `toolbarItems`
   * y Toast UI usa su default interno (idéntico a esta lista).
   */
  private static readonly DEFAULT_TOOLBAR: string[][] = [
    ['heading', 'bold', 'italic', 'strike'],
    ['hr', 'quote'],
    ['ul', 'ol', 'task', 'indent', 'outdent'],
    ['table', 'image', 'link'],
    ['code', 'codeblock'],
    ['scrollSync'],
  ];

  /**
   * Snippets con líneas en blanco alrededor del contenido interior para que
   * marked parsee el markdown de dentro del `<div>`. Las clases son EXACTAS
   * a las definidas en `src/app/cursos/ui/_prose.scss`.
   */
  private static readonly SNIPPETS = {
    'callout--info':
      '\n<div class="callout callout--info">\n\n**Recuerda.** Texto...\n\n</div>\n',
    'callout--exito':
      '\n<div class="callout callout--exito">\n\n**Bien.** Texto...\n\n</div>\n',
    'callout--aviso':
      '\n<div class="callout callout--aviso">\n\n**Ojo.** Texto...\n\n</div>\n',
    'callout--peligro':
      '\n<div class="callout callout--peligro">\n\n**Importante.** Texto...\n\n</div>\n',
    recuadro: '\n<div class="recuadro">\n\nTexto enmarcado...\n\n</div>\n',
    resaltado: '<span class="resaltado">texto resaltado</span>',
  } as const;

  private static readonly SNIPPET_ICONS: Record<SnippetClave, string> = {
    'callout--info': 'ℹ️',
    'callout--exito': '✅',
    'callout--aviso': '⚠️',
    'callout--peligro': '⛔',
    recuadro: '▢',
    resaltado: '🖍',
  };

  private static readonly SNIPPET_TOOLTIPS: Record<SnippetClave, string> = {
    'callout--info': 'Insertar recuadro de información',
    'callout--exito': 'Insertar recuadro de éxito',
    'callout--aviso': 'Insertar recuadro de aviso',
    'callout--peligro': 'Insertar recuadro importante',
    recuadro: 'Insertar recuadro enmarcado',
    resaltado: 'Resaltar texto',
  };

  // `Editor` (named export) es un namespace en los typings → se usa como valor
  // pero se tipa la instancia como `any` (mismo patrón que el resto del repo).
  private editor?: any;
  private pendingValue = '';
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    // Defer initialization to next tick to allow layout/CSS to stabilize
    // and avoid visual glitch where Markdown and WYSIWYG views overlap briefly.
    requestAnimationFrame(() => {
      // Toast UI agrupa la toolbar por sub-arrays; los botones custom de
      // cursos van como grupo final. Sin `cursosToolbar` NO se pasa
      // `toolbarItems` → default interno de Toast UI (comportamiento intacto
      // para el resto de consumidores).
      const extra = this.extraToolbarItems();
      this.editor = new Editor({
        el: this.host.nativeElement,
        ...universalEditorConfig,
        height: this.height,
        previewStyle: this.previewStyle,
        initialValue: this.pendingValue,
        ...(extra.length
          ? {
              toolbarItems: [...MarkdownEditorComponent.DEFAULT_TOOLBAR, extra],
            }
          : {}),
        events: {
          change: () => {
            const md = this.editor?.getMarkdown() ?? '';
            this.onChange(md);
          },
          blur: () => this.onTouched(),
        },
      });
    });
  }

  /** Inserta el snippet HTML+markdown de la clave dada en el cursor. */
  insertarSnippet(clave: SnippetClave): void {
    this.editor?.insertText(MarkdownEditorComponent.SNIPPETS[clave]);
  }

  /**
   * Grupo de botones custom para la toolbar de cursos. Vacío salvo que
   * `cursosToolbar` esté activo.
   */
  extraToolbarItems(): ToolbarCustomItem[] {
    if (!this.cursosToolbar()) return [];
    return (
      Object.entries(MarkdownEditorComponent.SNIPPET_ICONS) as [
        SnippetClave,
        string,
      ][]
    ).map(([clave, texto]) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'toastui-editor-toolbar-icons cursos-toolbar-btn';
      el.textContent = texto;
      el.addEventListener('click', () => this.insertarSnippet(clave));
      return {
        el,
        name: clave,
        tooltip: MarkdownEditorComponent.SNIPPET_TOOLTIPS[clave],
      };
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // ---- ControlValueAccessor ----
  writeValue(value: string | null): void {
    const v = value ?? '';
    if (this.editor) {
      // Evita re-emitir change al setear programáticamente.
      if (this.editor.getMarkdown() !== v) this.editor.setMarkdown(v, false);
    } else {
      this.pendingValue = v;
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // Toast UI no expone disable simple; no-op (el form admin no lo usa).
  }
}
