# Staging — Changelog candidatas de duda + importar Excel

**Branch:** `staging`
**URL:** https://app-staging.tecnikafire.com
**Último commit:** `f11c631` (centralizar resets en sincronizarEstadoPregunta)

## Features

### 1. Candidatas de duda (UI alumno)

En el componente `completar-test`, el alumno puede marcar 2 o 3 respuestas como "dudas" mientras decide la final. Las dudas persisten en BD y se restauran al navegar o recargar.

**Flujo UX:**

1. Seleccionar "Dudo entre 2" (75%) o "Dudo entre 3" (50%) → aparece banner "¿Quieres marcar las N respuestas entre las que dudas?" con botón **"Marcar las que dudo"**.
2. Click en "Marcar las que dudo" → entra en **modo selección**:
   - Banner se convierte en "¿Entre qué N dudas? Selecciónalas tocando las respuestas. (X/N)".
   - Botón **"Listo"** para salir del modo.
   - Click en respuestas: se alternan como candidatas (borde `primary`) o descartadas (opacidad 0.45).
   - En modo selección **no se aplica** el coloreado de respuesta correcta/incorrecta/seleccionada.
3. Click en "Listo" → sale del modo:
   - Banner se convierte en "Dudas marcadas: X/N" con botón **"Editar dudas"** (re-entrar al modo).
   - Candidatas y descartadas se mantienen visualmente (no se rotan al elegir respuesta final).
4. **Navegador lateral:** pregunta con candidatas muestra borde dashed + dot `primary`.

**Persistencia en BD (no localStorage):**
- Patrón `CandidatasSnapshot` con `debounceTime(300) + switchMap + takeUntilDestroyed`.
- Al marcar candidatas sin responder: draft `{estado:'NO_RESPONDIDA', respuestaDada:null, seguridad, respuestasCandidatas}`.
- Al navegar adelante/atrás: se persiste el snapshot actual.
- Al recargar página: `sincronizarEstadoPregunta` restaura candidatas y seguridad desde `respuestaOBorrador(i)`.

### 2. Auto-omitir inteligente al navegar

**Comportamiento original preservado:** si el alumno navega Adelante/Atrás sin responder y sin tocar nada → pregunta se auto-omite (igual que antes).

**Nuevo comportamiento:** si el alumno mostró **intención de dudar** (candidatas marcadas o seguridad distinta a 100%) → **NO se auto-omite**, se persiste como draft. Al volver, el estado intermedio sigue ahí.

Lógica (`completar-test.component.ts:588-602`):
```ts
const tieneIntencionDeDudar =
  (this.candidatasPorPregunta() ?? []).length > 0 ||
  (this.seguroDeLaPregunta.value != null &&
   this.seguroDeLaPregunta.value !== SeguridadAlResponder.CIEN_POR_CIENTO);
const isOmitida =
  mode == 'omitir' ||
  ((mode == 'next' || mode == 'before') &&
   !isAnswered &&
   !tieneIntencionDeDudar);
```

**Matriz:**

| Situación | `isOmitida` | Resultado |
|---|---|---|
| Click explícito "Omitir" | true | OMITIDA |
| Responder + Adelante | false | RESPONDIDA (conservado) |
| Solo navegar sin tocar nada | **true** | **OMITIDA (comportamiento antiguo preservado)** |
| Candidatas marcadas + navegar | false | NO_RESPONDIDA (draft) |
| Seguridad=75/50 + navegar | false | NO_RESPONDIDA (draft) |

### 3. Importar Excel en examen (admin)

Cuarto método de importación de preguntas en el detalle del examen admin: **Importar Excel**.

Usa el mismo formato xlsx que el importador global (`preguntas/importar-excel`) pero asocia las preguntas al `examenId` actual.

UI:
- Upload drag&drop del archivo xlsx.
- Formulario: `temaId` (required), `dificultad` (required), `esReserva` (opcional).
- Toast de éxito/error.
- Reset del input tras importar.

## Codex reviews (Front)

2 rondas:
- **R1 (commit `9c419c0`):** P1 detectado — `siguiente()` después de `adelante()` reseteaba `seguroDeLaPregunta` a CIEN, pisando la seguridad restaurada de la pregunta destino. En el caso "duda solo por seguridad" al llegar mediante Siguiente, la UI mostraba "No dudo" y al pulsar Adelante auto-omitía.
- **R2 (commit `f11c631`):** **CLEAN**. Resets de UI centralizados en `sincronizarEstadoPregunta` (single source of truth). Eliminados los resets redundantes que pisaban estado.

## QA manual realizado en staging

1. ✅ Flujo candidatas completo: seleccionar "Dudo entre 2" → "Marcar las que dudo" → click 2 respuestas → "Listo" → navegar Adelante → Atrás → **candidatas preservadas**.
2. ✅ F5 (recarga) → click pregunta 1 → **candidatas restauradas de BD**.
3. ✅ Comportamiento legacy: pregunta intacta + Adelante → **auto-omite correctamente**.
4. ✅ Responder pregunta + Continuar → siguiente → Atrás → **respuesta preservada (no se reabre)**.
5. ✅ Importar Excel admin: xlsx con 3 preguntas → creadas con `examenId` correcto.
