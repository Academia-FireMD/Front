import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  Input,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { MarkdownComponent } from 'ngx-markdown';
import { universalEditorConfig } from '../../utils/utils';

/** Claves de los snippets de la toolbar de cursos (clases de `_prose.scss`). */
export type SnippetClave =
  | 'callout--info'
  | 'callout--exito'
  | 'callout--aviso'
  | 'callout--peligro'
  | 'recuadro'
  | 'resaltado';

/** Chip de la barra de inserción de recuadros (solo con `cursosToolbar`). */
export interface SnippetChip {
  clave: SnippetClave;
  icono: string;
  etiqueta: string;
  titulo: string;
  /** Clase modificadora BEM que da al chip el color de su propio recuadro. */
  claseColor: string;
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
 *
 * Con `cursosToolbar` la preview de Toast UI se SUSTITUYE por un panel propio
 * que renderiza el markdown con el mismo pipeline que la vista del alumno
 * (ngx-markdown + `.cursos-prose`). Motivo: Toast UI parsea CommonMark
 * estricto y no procesa el markdown que va DENTRO de un `<div>` HTML, así que
 * los recuadros salían como cajas de color vacías con su texto colgando
 * debajo — justo lo contrario de lo que promete la barra de chips. La línea en
 * blanco de los snippets es necesaria para el renderer del alumno (marked), no
 * se toca: el que cambia es el panel de previa.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [MarkdownComponent],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
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
   * Activa una barra propia bajo el editor para insertar los snippets de
   * callout/resaltado/recuadro de las lecciones de cursos (clases CSS de
   * `cursos/ui/_prose.scss`), para que el profe no escriba HTML a mano.
   * Default `false`: el resto de consumidores del editor (preguntas,
   * flashcards, planificación física) no cambian.
   *
   * Antes estos botones se inyectaban DENTRO de la toolbar de Toast UI; en el
   * ancho del diálogo de bloques Toast UI los colapsaba en el menú "···" y la
   * funcionalidad quedaba invisible, así que se sacaron a una fila propia
   * (feedback Gonzalo). Al no pasar ya `toolbarItems`, Toast UI usa su toolbar
   * por defecto y desaparece la réplica que había que mantener a mano.
   */
  cursosToolbar = input(false);

  /**
   * Snippets con líneas en blanco alrededor del contenido interior para que
   * marked parsee el markdown de dentro del `<div>`. Las clases son EXACTAS
   * a las definidas en `src/app/cursos/ui/_prose.scss`.
   *
   * Los de BLOQUE cierran con `</div>\n\n` — línea en blanco final, no un solo
   * salto. Un bloque HTML de markdown no termina hasta la primera línea en
   * blanco: con `</div>\n` la línea siguiente seguía DENTRO del bloque, así que
   * al insertar un recuadro en mitad del documento el `# Título` de debajo se
   * renderizaba como texto literal (QA ronda 2). `resaltado` es inline y no
   * lleva saltos a propósito: envuelve texto dentro de un párrafo.
   */
  private static readonly SNIPPETS = {
    'callout--info':
      '\n<div class="callout callout--info">\n\n**Recuerda.** Texto...\n\n</div>\n\n',
    'callout--exito':
      '\n<div class="callout callout--exito">\n\n**Bien.** Texto...\n\n</div>\n\n',
    'callout--aviso':
      '\n<div class="callout callout--aviso">\n\n**Ojo.** Texto...\n\n</div>\n\n',
    'callout--peligro':
      '\n<div class="callout callout--peligro">\n\n**Importante.** Texto...\n\n</div>\n\n',
    recuadro: '\n<div class="recuadro">\n\nTexto enmarcado...\n\n</div>\n\n',
    resaltado: '<span class="resaltado">texto resaltado</span>',
  } as const;

  /**
   * Chips de la barra de inserción. El emoji solo no se entendía, así que cada
   * chip lleva ETIQUETA de texto además del icono y el color de su propio
   * recuadro (`markdown-editor.component.scss`, valores calcados de
   * `cursos/ui/_prose.scss`).
   */
  protected readonly chips: readonly SnippetChip[] = [
    {
      clave: 'callout--info',
      icono: 'ℹ️',
      etiqueta: 'Información',
      titulo: 'Insertar recuadro de información',
      claseColor: 'md-insert-bar__chip--info',
    },
    {
      clave: 'callout--exito',
      icono: '✅',
      etiqueta: 'Éxito',
      titulo: 'Insertar recuadro de éxito',
      claseColor: 'md-insert-bar__chip--exito',
    },
    {
      clave: 'callout--aviso',
      icono: '⚠️',
      etiqueta: 'Aviso',
      titulo: 'Insertar recuadro de aviso',
      claseColor: 'md-insert-bar__chip--aviso',
    },
    {
      clave: 'callout--peligro',
      icono: '⛔',
      etiqueta: 'Importante',
      titulo: 'Insertar recuadro importante',
      claseColor: 'md-insert-bar__chip--peligro',
    },
    {
      clave: 'recuadro',
      icono: '▢',
      etiqueta: 'Recuadro',
      titulo: 'Insertar recuadro enmarcado',
      claseColor: 'md-insert-bar__chip--recuadro',
    },
    {
      clave: 'resaltado',
      icono: '🖍',
      etiqueta: 'Resaltar',
      titulo: 'Resaltar el texto seleccionado',
      claseColor: 'md-insert-bar__chip--resaltado',
    },
  ];

  /**
   * Markdown actual del editor. Alimenta el panel de vista previa propio (solo
   * con `cursosToolbar`) y se actualiza en vivo: en cada `change` de Toast UI y
   * en cada `writeValue` del formulario.
   */
  protected readonly valorActual = signal('');

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
      // NO se pasa `toolbarItems`: Toast UI usa su toolbar por defecto en
      // todos los casos. Los botones de recuadros de cursos viven ahora en la
      // fila propia del template (`.md-insert-bar`), no en esta toolbar.
      this.editor = new Editor({
        el: this.host.nativeElement,
        ...universalEditorConfig,
        height: this.height,
        // Con la barra de cursos NO se usa el split de Toast UI: su preview la
        // sustituye el panel propio (render real del alumno), así que el
        // editor markdown ocupa toda su columna. `tab` es el modo de Toast UI
        // que deja el área de escritura a ancho completo; su pestaña
        // "Preview" se oculta por CSS (`styles.scss`) para que no haya dos
        // previas contradictorias.
        previewStyle: this.cursosToolbar() ? 'tab' : this.previewStyle,
        initialValue: this.pendingValue,
        events: {
          change: () => {
            const md = this.editor?.getMarkdown() ?? '';
            this.valorActual.set(md);
            this.onChange(md);
          },
          blur: () => this.onTouched(),
        },
      });
    });
  }

  /**
   * Inserta el snippet HTML+markdown de la clave dada en el cursor.
   * Para `resaltado`, si hay texto seleccionado, lo envuelve en
   * `<span class="resaltado">...</span>` en lugar de insertar el placeholder.
   */
  insertarSnippet(clave: SnippetClave): void {
    if (clave === 'resaltado') {
      const selectedText = this.editor?.getSelectedText?.();
      if (selectedText) {
        // Envolver selección en span.resaltado
        this.editor?.replaceSelection(
          `<span class="resaltado">${selectedText}</span>`,
        );
      } else {
        // Sin selección, usar el placeholder predefinido
        this.editor?.insertText(MarkdownEditorComponent.SNIPPETS[clave]);
      }
    } else {
      // Callouts y otros snippets: insertar directamente
      this.editor?.insertText(MarkdownEditorComponent.SNIPPETS[clave]);
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // ---- ControlValueAccessor ----
  writeValue(value: string | null): void {
    const v = value ?? '';
    this.valorActual.set(v);
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
