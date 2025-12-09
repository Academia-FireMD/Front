import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Group } from '../../shared/models/group.model';
import { Label } from '../../shared/models/label.model';
import { AudienceType, CreateAudienceRuleDto, Release, ReleaseItemType, RuleEffect } from '../../shared/models/release.model';
import { Oposicion, SuscripcionTipo } from '../../shared/models/subscription.model';
import { GroupsService } from '../../shared/services/groups.service';
import { LabelsService } from '../../shared/services/labels.service';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-release-management',
  templateUrl: './release-management.component.html',
  styleUrls: ['./release-management.component.scss']
})
export class ReleaseManagementComponent implements OnInit {
  releases: Release[] = [];
  selectedRelease: Release | null = null;
  releaseForm: FormGroup;
  showReleaseDialog = false;
  showItemsDialog = false;
  showAudienceDialog = false;
  loading = false;
  savingRelease = false;

  // Para items
  selectedDocumentoIds: number[] = [];
  currentReleaseItems: any[] = [];
  showDocumentPickerDialog = false;

  // Para visualización de documentos agrupados (acordeón)
  documentTree: any[] = [];

  // Para audiencia
  labels: Label[] = [];
  groups: Group[] = [];
  audienceRules: CreateAudienceRuleDto[] = [];

  // Para selector de usuarios
  showUserSelectorDialog = false;
  users: any[] = [];
  filteredUsers: any[] = [];
  userSearchTerm = '';
  selectedUserId: number | null = null;
  currentRuleForUser: CreateAudienceRuleDto | null = null;

  // Enums para templates
  AudienceType = AudienceType;
  RuleEffect = RuleEffect;
  ReleaseItemType = ReleaseItemType;
  SuscripcionTipo = SuscripcionTipo;
  Oposicion = Oposicion;

  constructor(
    private fb: FormBuilder,
    private releaseService: ReleaseService,
    private labelsService: LabelsService,
    private groupsService: GroupsService,
    private userService: UserService
  ) {
    this.releaseForm = this.fb.group({
      name: ['', Validators.required],
      startAt: [null, Validators.required],
      endAt: [null, Validators.required]
    }, {
      validators: this.dateRangeValidator
    });
  }

  // Validador personalizado para verificar que startAt < endAt
  dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startAt = control.get('startAt')?.value;
    const endAt = control.get('endAt')?.value;

    if (startAt && endAt) {
      const start = startAt instanceof Date ? startAt : new Date(startAt);
      const end = endAt instanceof Date ? endAt : new Date(endAt);

      if (start >= end) {
        return { dateRange: true };
      }
    }

    return null;
  }

  ngOnInit(): void {
    this.loadReleases();
    this.loadLabels();
    this.loadGroups();
    this.loadUsers();
  }

  loadReleases(): void {
    this.loading = true;
    this.releaseService.getReleases().subscribe({
      next: (releases) => {
        this.releases = releases;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar releases:', err);
        this.loading = false;
      }
    });
  }

  openDocumentPicker(): void {
    this.showDocumentPickerDialog = true;
  }

  onDocumentSelectionChange(ids: number[]): void {
    this.selectedDocumentoIds = ids;
  }

  saveDocumentSelection(): void {
    if (!this.selectedRelease || this.selectedDocumentoIds.length === 0) {
      this.showDocumentPickerDialog = false;
      return;
    }

    // Obtener IDs de documentos ya existentes en el release
    const existingDocIds = new Set(
      this.currentReleaseItems
        .filter(item => item.itemType === 'DOCUMENTO' && item.documentoId)
        .map(item => item.documentoId)
    );

    // Filtrar solo los documentos nuevos (no duplicados)
    const newDocIds = this.selectedDocumentoIds.filter(
      docId => !existingDocIds.has(docId)
    );

    if (newDocIds.length === 0) {
      // Todos los documentos seleccionados ya están en el release
      console.log('⚠️ Todos los documentos ya están en esta publicación');
      this.showDocumentPickerDialog = false;
      return;
    }

    const items = newDocIds.map((documentoId) => ({
      itemType: this.ReleaseItemType.DOCUMENTO,
      documentoId
    }));

    console.log(`📝 Añadiendo ${newDocIds.length} documento(s) nuevo(s) de ${this.selectedDocumentoIds.length} seleccionado(s)`);

    this.releaseService.addItems(this.selectedRelease.id, items as any).subscribe({
      next: () => {
        this.loadReleases();
        this.showDocumentPickerDialog = false;
        // Recargar items actuales y reconstruir el árbol
        this.releaseService.getRelease(this.selectedRelease!.id).subscribe({
          next: (release) => {
            this.currentReleaseItems = release.items || [];
            this.selectedRelease = release;
            this.buildDocumentTree();
          }
        });
      },
      error: (err) => console.error('Error al guardar items:', err)
    });
  }

  removeReleaseItem(itemId: string): void {
    if (!this.selectedRelease) return;
    this.releaseService.removeItem(this.selectedRelease.id, itemId).subscribe({
      next: () => {
        this.currentReleaseItems = this.currentReleaseItems.filter(item => item.id !== itemId);
        this.buildDocumentTree(); // Reconstruir el árbol
        this.loadReleases();
      },
      error: (err) => console.error('Error al eliminar item:', err)
    });
  }

  getItemTypeLabel(type: string): string {
    return type === 'TEMA' ? 'Tema' : 'Documento';
  }

  getItemName(item: any): string {
    if (item.itemType === 'TEMA') {
      return item.tema?.descripcion || `Tema ${item.temaId}`;
    } else {
      return item.documento?.identificador || `Documento ${item.documentoId}`;
    }
  }

  getItemIdFromDocument(doc: any): string {
    // Usar el _itemId que agregamos durante buildDocumentTree
    return doc._itemId || '';
  }

  loadLabels(): void {
    this.labelsService.getLabels().subscribe({
      next: (labels) => {
        // Agregar displayLabel para el dropdown
        this.labels = labels.map(label => ({
          ...label,
          displayLabel: `${label.key}${label.value ? ': ' + label.value : ''}`
        } as any));
      },
      error: (err) => console.error('Error al cargar labels:', err)
    });
  }

  loadGroups(): void {
    this.groupsService.getGroups().subscribe({
      next: (groups) => this.groups = groups,
      error: (err) => console.error('Error al cargar grupos:', err)
    });
  }

  loadUsers(): void {
    // Cargar todos los usuarios para el selector
    this.userService.getAllUsers$({ skip: 0, take: 1000, searchTerm: '' }).subscribe({
      next: (response) => {
        this.users = response.data;
        this.filteredUsers = response.data;
      },
      error: (err) => console.error('Error al cargar usuarios:', err)
    });
  }

  openCreateReleaseDialog(): void {
    this.selectedRelease = null;
    this.releaseForm.reset();
    this.showReleaseDialog = true;
  }

  openEditReleaseDialog(release: Release): void {
    this.selectedRelease = release;
    // Convertir las fechas de string ISO a Date objects para p-calendar
    const startDate = new Date(release.startAt);
    const endDate = new Date(release.endAt);

    this.releaseForm.patchValue({
      name: release.name,
      startAt: startDate,
      endAt: endDate
    });
    this.showReleaseDialog = true;
  }

  saveRelease(): void {
    if (this.releaseForm.invalid) {
      console.warn('Formulario inválido:', this.releaseForm.errors);
      return;
    }

    this.savingRelease = true;
    const formValue = this.releaseForm.value;

    // Convertir las fechas a ISO string
    const startAt = formValue.startAt instanceof Date
      ? formValue.startAt
      : new Date(formValue.startAt);
    const endAt = formValue.endAt instanceof Date
      ? formValue.endAt
      : new Date(formValue.endAt);

    const dto = {
      name: formValue.name,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    };

    console.log('💾 Guardando release:', {
      isEdit: !!this.selectedRelease,
      id: this.selectedRelease?.id,
      dto
    });

    if (this.selectedRelease) {
      this.releaseService.updateRelease(this.selectedRelease.id, dto).subscribe({
        next: () => {
          console.log('✅ Release actualizado');
          this.loadReleases();
          this.closeReleaseDialog();
          this.savingRelease = false;
        },
        error: (err) => {
          console.error('❌ Error al actualizar release:', err);
          this.savingRelease = false;
        }
      });
    } else {
      this.releaseService.createRelease(dto).subscribe({
        next: () => {
          console.log('✅ Release creado');
          this.loadReleases();
          this.closeReleaseDialog();
          this.savingRelease = false;
        },
        error: (err) => {
          console.error('❌ Error al crear release:', err);
          this.savingRelease = false;
        }
      });
    }
  }

  deleteRelease(id: string): void {
    if (!confirm('¿Estás seguro de eliminar este release?')) return;

    this.releaseService.deleteRelease(id).subscribe({
      next: () => this.loadReleases(),
      error: (err) => console.error('Error al eliminar release:', err)
    });
  }

  openItemsDialog(release: Release): void {
    this.selectedRelease = release;
    this.currentReleaseItems = release.items || [];
    // Preseleccionar los documentos que ya están en el release
    this.selectedDocumentoIds = this.currentReleaseItems
      .filter(item => item.itemType === 'DOCUMENTO')
      .map(item => item.documentoId);

    // Construir el árbol de documentos para visualización
    this.buildDocumentTree();

    this.showItemsDialog = true;
  }

  buildDocumentTree(): void {
    // 1. Deduplicar documentos (pueden venir duplicados en items)
    const uniqueDocsMap = new Map<number, any>();
    const documentToItemMap = new Map<number, string>(); // Para el botón de eliminar

    this.currentReleaseItems.forEach(item => {
      if (item.itemType === 'DOCUMENTO' && item.documento) {
        const doc = item.documento;
        if (!uniqueDocsMap.has(doc.id)) {
          uniqueDocsMap.set(doc.id, doc);
          documentToItemMap.set(doc.id, item.id); // Guardar el primer item ID encontrado
        }
      }
    });

    // 2. Agrupar documentos únicos por tema
    const documentsByTema = new Map<number, any[]>();
    const temasInfo = new Map<number, any>();

    uniqueDocsMap.forEach((doc) => {
      const temaId = doc.temaId || 0; // 0 para documentos sin tema

      if (!documentsByTema.has(temaId)) {
        documentsByTema.set(temaId, []);
      }

      // Agregar el itemId al documento para poder eliminarlo
      const docWithItemId = {
        ...doc,
        _itemId: documentToItemMap.get(doc.id)
      };

      documentsByTema.get(temaId)!.push(docWithItemId);

      if (doc.tema && !temasInfo.has(temaId)) {
        temasInfo.set(temaId, doc.tema);
      }
    });

    // 3. Construir árbol agrupado por módulo
    const moduleMap = new Map<number, any>();

    documentsByTema.forEach((docs, temaId) => {
      const tema = temasInfo.get(temaId);

      if (temaId === 0 || !tema) {
        // Documentos sin tema
        if (!moduleMap.has(0)) {
          moduleMap.set(0, {
            id: 0,
            nombre: 'Sin clasificar',
            temas: []
          });
        }
        moduleMap.get(0)!.temas.push({
          id: 0,
          numero: 'N/A',
          descripcion: 'Sin tema',
          documentos: docs
        });
      } else {
        const moduloId = tema.moduloId || 0;

        if (!moduleMap.has(moduloId)) {
          // Intentar obtener el nombre del módulo desde tema.modulo
          let moduloNombre = 'Sin módulo';

          // El backend debería incluir tema.modulo, pero si no está, usar un fallback
          if (tema.modulo && tema.modulo.nombre) {
            moduloNombre = tema.modulo.nombre;
          }

          moduleMap.set(moduloId, {
            id: moduloId,
            nombre: moduloNombre,
            temas: []
          });
        }

        // Buscar si el tema ya existe en este módulo (para evitar duplicados)
        const modulo = moduleMap.get(moduloId)!;
        let temaEntry = modulo.temas.find((t: any) => t.id === temaId);

        if (!temaEntry) {
          temaEntry = {
            id: temaId,
            numero: tema.numero,
            descripcion: tema.descripcion,
            documentos: []
          };
          modulo.temas.push(temaEntry);
        }

        // Agregar documentos al tema (deduplicados)
        temaEntry.documentos.push(...docs);
      }
    });

    // 4. Convertir a array y ordenar
    this.documentTree = Array.from(moduleMap.values())
      .sort((a, b) => {
        // Ordenar módulos (0 = Sin clasificar al final)
        if (a.id === 0) return 1;
        if (b.id === 0) return -1;
        return a.id - b.id;
      })
      .map(modulo => ({
        ...modulo,
        temas: modulo.temas.sort((a: any, b: any) => {
          // Ordenar temas por número
          if (a.numero === 'N/A') return 1;
          if (b.numero === 'N/A') return -1;
          return parseInt(a.numero) - parseInt(b.numero);
        })
      }));

    console.log('📊 Document tree built:', this.documentTree);
  }

  openAudienceDialog(release: Release): void {
    this.selectedRelease = release;
    // Cargar las reglas existentes del release
    this.audienceRules = release.audienceRules?.map(rule => ({
      type: rule.type,
      value: rule.value,
      effect: rule.effect
    })) || [];
    this.showAudienceDialog = true;
  }

  addAudienceRule(): void {
    this.audienceRules.push({
      type: AudienceType.ALL,
      effect: RuleEffect.ALLOW
    });
  }

  removeAudienceRule(index: number): void {
    this.audienceRules.splice(index, 1);
  }

  saveAudienceRules(): void {
    if (!this.selectedRelease || this.audienceRules.length === 0) return;

    this.releaseService.addAudienceRules(this.selectedRelease.id, this.audienceRules).subscribe({
      next: () => {
        this.loadReleases();
        this.closeAudienceDialog();
      },
      error: (err) => console.error('Error al guardar reglas:', err)
    });
  }

  deleteAudienceRuleFromRelease(releaseId: string, ruleId: string): void {
    this.releaseService.removeAudienceRule(releaseId, ruleId).subscribe({
      next: () => this.loadReleases(),
      error: (err) => console.error('Error al eliminar regla:', err)
    });
  }

  closeReleaseDialog(): void {
    this.showReleaseDialog = false;
    this.selectedRelease = null;
    this.releaseForm.reset();
    this.savingRelease = false;
  }

  closeItemsDialog(): void {
    this.showItemsDialog = false;
    this.selectedRelease = null;
  }

  closeAudienceDialog(): void {
    this.showAudienceDialog = false;
    this.selectedRelease = null;
    this.audienceRules = [];
  }

  private formatDateForInput(date: string | Date): string {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  }

  getSubscriptionTypes(): string[] {
    return Object.values(SuscripcionTipo);
  }

  getOposiciones(): { label: string; value: string }[] {
    return [
      { label: 'Valencia Ayuntamiento', value: Oposicion.VALENCIA_AYUNTAMIENTO },
      { label: 'CPBA Alicante', value: Oposicion.ALICANTE_CPBA }
    ];
  }

  // Métodos para selector de usuarios
  onRuleTypeChange(rule: CreateAudienceRuleDto): void {
    // Limpiar el valor cuando cambia el tipo
    rule.value = undefined;
  }

  openUserSelector(rule: CreateAudienceRuleDto): void {
    this.currentRuleForUser = rule;
    this.selectedUserId = rule.value ? parseInt(rule.value) : null;
    this.userSearchTerm = '';
    this.filteredUsers = this.users;
    this.showUserSelectorDialog = true;
  }

  selectUser(user: any): void {
    this.selectedUserId = user.id;
  }

  filterUsers(): void {
    const term = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.email.toLowerCase().includes(term) ||
      (user.nombre && user.nombre.toLowerCase().includes(term)) ||
      (user.apellidos && user.apellidos.toLowerCase().includes(term))
    );
  }

  confirmUserSelection(): void {
    if (this.currentRuleForUser && this.selectedUserId) {
      this.currentRuleForUser.value = this.selectedUserId.toString();
    }
    this.closeUserSelector();
  }

  closeUserSelector(): void {
    this.showUserSelectorDialog = false;
    this.currentRuleForUser = null;
    this.selectedUserId = null;
    this.userSearchTerm = '';
  }

  getSelectedUserEmail(userId: string | undefined): string {
    if (!userId) return '';
    const user = this.users.find(u => u.id === parseInt(userId));
    return user ? user.email : 'Usuario no encontrado';
  }

  getAudienceTypeDisplay(type: AudienceType): string {
    const map = {
      [AudienceType.ALL]: 'Todos',
      [AudienceType.SUBSCRIPTION]: 'Suscripción',
      [AudienceType.OPOSICION]: 'Oposición',
      [AudienceType.GROUP]: 'Grupo',
      [AudienceType.LABEL]: 'Etiqueta',
      [AudienceType.INDIVIDUAL]: 'Individual'
    };
    return map[type] || type;
  }

  getAudienceRuleValueDisplay(rule: any): string {
    if (!rule.value) return '';

    switch (rule.type) {
      case AudienceType.LABEL:
        // Buscar la etiqueta por ID y mostrar su formato legible
        const label = this.labels.find(l => l.id === rule.value);
        if (label) {
          return `${label.key}${label.value ? ': ' + label.value : ''}`;
        }
        return rule.value; // Fallback al ID si no se encuentra

      case AudienceType.INDIVIDUAL:
        // Mostrar el email del usuario
        const user = this.users.find(u => u.id === parseInt(rule.value));
        return user ? user.email : rule.value;

      case AudienceType.SUBSCRIPTION:
        // Mostrar el tipo de suscripción
        return rule.value;

      case AudienceType.OPOSICION:
        // Mostrar el nombre de la oposición
        const oposicion = this.getOposiciones().find(o => o.value === rule.value);
        return oposicion ? oposicion.label : rule.value;

      case AudienceType.GROUP:
        // Mostrar el nombre del grupo
        const group = this.groups.find(g => g.id === rule.value);
        return group ? group.name : rule.value;

      default:
        return rule.value;
    }
  }
}

