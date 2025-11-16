import { ChangeDetectionStrategy, Component, computed, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { AccordionModule } from 'primeng/accordion';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { CalendarioHorariosComponent, DiaEstado } from '../calendario-horarios/calendario-horarios.component';
import { HorariosService } from '../../servicios/horarios.service';
import { HorariosUtilsService } from '../../servicios/horarios-utils.service';
import {
  EstadoReserva,
  HorarioDisponible,
  Reserva,
  UpdateEstadoReservaDto
} from '../../models/horario.model';
import { GenericListComponent, FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';
import { PaginatedResult } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-horarios-admin',
  templateUrl: './horarios-admin.component.html',
  styleUrl: './horarios-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CalendarModule,
    CheckboxModule,
    DialogModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    TableModule,
    TabViewModule,
    TooltipModule,
    AccordionModule,
    ConfirmDialogModule,
    CalendarioHorariosComponent,
    GenericListComponent,
    AsyncButtonComponent
  ],
  providers: [ConfirmationService]
})
export class HorariosAdminComponent {
  horariosService = inject(HorariosService);
  utils = inject(HorariosUtilsService);
  toast = inject(ToastrService);
  confirmationService = inject(ConfirmationService);

  @ViewChild('horarioItemTemplate') horarioItemTemplate!: TemplateRef<any>;
  @ViewChild('reservaItemTemplate') reservaItemTemplate!: TemplateRef<any>;

  EstadoReserva = EstadoReserva;

  horarios = signal<HorarioDisponible[]>([]);
  reservas = signal<Reserva[]>([]);
  horaInicio = signal<number>(7);
  horaFin = signal<number>(23);
  capacidad = signal<number>(1);
  descripcionHorarios = signal<string>('');
  fechaSeleccionada = signal<Date | null>(null);
  reservasSeleccionadas = signal<number[]>([]);
  mostrarDialogCancelacion = signal<boolean>(false);
  motivoCancelacion = signal<string>('');
  reservasACancelar = signal<number[]>([]);
  activeTab = signal<number>(0);
  fechasSeleccionadasHorarios = signal<Date[]>([]);
  horariosExistentes = signal<HorarioDisponible[]>([]);
  horariosSeleccionadosEliminar = signal<number[]>([]);
  horarioEditando = signal<HorarioDisponible | null>(null);
  mostrarDialogEditar = signal<boolean>(false);
  horarioEditHoraInicio = signal<number>(0);
  horarioEditHoraFin = signal<number>(1);
  horarioEditCapacidad = signal<number>(1);
  horarioEditDescripcion = signal<string>('');
  mostrarHorariosPasados = signal<boolean>(true);
  busquedaAlumno = signal<string>('');

  reservasActivasHorarioEditando = computed(() => {
    const horario = this.horarioEditando();
    if (!horario || !horario.reservas) return 0;
    // Solo contar reservas PENDIENTE y CONFIRMADA (las que ocupan capacidad)
    return horario.reservas.filter(
      r => r.estado === EstadoReserva.PENDIENTE || r.estado === EstadoReserva.CONFIRMADA
    ).length;
  });

  capacidadMinimaHorarioEditando = computed(() => {
    const reservasActivas = this.reservasActivasHorarioEditando();
    return Math.max(1, reservasActivas);
  });

  horas = Array.from({ length: 24 }, (_, i) => ({ label: `${i.toString().padStart(2, '0')}:00`, value: i }));

  // Filtros para GenericListComponent
  filtrosHorarios: FilterConfig[] = [
    {
      key: 'mostrarPasados',
      label: 'Mostrar horarios pasados',
      type: 'toggle',
      defaultValue: true
    }
  ];

  filtrosReservas: FilterConfig[] = [
    {
      key: 'busqueda',
      label: 'Buscar alumno',
      type: 'text',
      placeholder: 'Buscar por nombre, apellidos o email'
    }
  ];

  diasEstados = computed(() => {
    return this.utils.calcularDiasEstados(this.horarios(), this.reservas());
  });

  reservasDelDia = computed(() => {
    const fecha = this.fechaSeleccionada();
    if (!fecha) return [];
    
    return this.reservas().filter(reserva => {
      if (!reserva.horarioDisponible) return false;
      const fechaReserva = this.utils.toDate(reserva.horarioDisponible.fecha);
      return this.utils.getDateKey(fechaReserva) === this.utils.getDateKey(fecha);
    });
  });

  reservasDelDiaFiltradas = computed(() => {
    const reservas = this.reservasDelDia();
    const busqueda = this.busquedaAlumno().toLowerCase().trim();
    
    if (!busqueda) {
      return reservas;
    }
    
    return reservas.filter(reserva => {
      const nombre = `${reserva.alumno?.nombre || ''} ${reserva.alumno?.apellidos || ''}`.toLowerCase();
      const email = (reserva.alumno?.email || '').toLowerCase();
      return nombre.includes(busqueda) || email.includes(busqueda);
    });
  });

  reservasCancelables = computed(() => {
    return this.reservasDelDiaFiltradas().filter(r => this.puedeCancelarReserva(r));
  });

  reservasCambiables = computed(() => {
    return this.reservasDelDiaFiltradas().filter(r => this.puedeCambiarEstado(r));
  });

  todasLasReservasCancelablesSeleccionadas = computed(() => {
    const cambiables = this.reservasCambiables();
    const seleccionadas = this.reservasSeleccionadas();
    return cambiables.length > 0 && cambiables.every(r => seleccionadas.includes(r.id));
  });

  horariosFiltrados = computed(() => {
    const fecha = this.fechaSeleccionada();
    let todosHorarios = this.horarios();
    
    if (!this.mostrarHorariosPasados()) {
      todosHorarios = todosHorarios.filter(h => !this.utils.esHorarioPasado(h));
    }
    
    if (!fecha) {
      return todosHorarios;
    }
    
    return todosHorarios.filter(horario => {
      const fechaHorario = this.utils.toDate(horario.fecha);
      return this.utils.getDateKey(fechaHorario) === this.utils.getDateKey(fecha);
    });
  });

  // Helpers para convertir datos locales a PaginatedResult para GenericListComponent
  fetchHorarios$ = computed(() => {
    const datos = this.horariosFiltrados();
    const resultado: PaginatedResult<HorarioDisponible> = {
      data: datos,
      pagination: {
        take: datos.length,
        skip: 0,
        searchTerm: '',
        count: datos.length
      }
    };
    return of(resultado);
  });

  fetchReservas$ = computed(() => {
    const datos = this.reservasDelDiaFiltradas();
    const resultado: PaginatedResult<Reserva> = {
      data: datos,
      pagination: {
        take: datos.length,
        skip: 0,
        searchTerm: '',
        count: datos.length
      }
    };
    return of(resultado);
  });

  fetchHorariosExistentes$ = computed(() => {
    const datos = this.horariosExistentes();
    const resultado: PaginatedResult<HorarioDisponible> = {
      data: datos,
      pagination: {
        take: datos.length,
        skip: 0,
        searchTerm: '',
        count: datos.length
      }
    };
    return of(resultado);
  });

  vistaPreviaHorarios = computed(() => {
    const fechas = this.fechasSeleccionadasHorarios();
    const inicio = this.horaInicio();
    const fin = this.horaFin();
    const capacidad = this.capacidad();
    const horariosExistentesData = this.horariosExistentes();

    if (fechas.length === 0 || inicio >= fin) {
      return null;
    }

    const diasNumeros = fechas.map(fecha => fecha.getDate()).sort((a, b) => a - b);
    const diasFormateados = diasNumeros.join(', ');

    // Obtener TODOS los horarios existentes para las fechas seleccionadas (sin filtrar por rango)
    const horariosExistentesTodosSet = new Set<string>();
    const fechasKeys = fechas.map(f => this.utils.getDateKey(f));
    
    horariosExistentesData.forEach(h => {
      const fechaH = this.utils.toDate(h.fecha);
      const fechaHKey = this.utils.getDateKey(fechaH);
      if (fechasKeys.includes(fechaHKey)) {
        const horaInicioH = this.utils.toDate(h.horaInicio);
        const horaFinH = this.utils.toDate(h.horaFin);
        const horaInicioStr = `${horaInicioH.getHours().toString().padStart(2, '0')}:00`;
        const horaFinStr = `${horaFinH.getHours().toString().padStart(2, '0')}:00`;
        const horarioKey = `${horaInicioStr}-${horaFinStr}`;
        horariosExistentesTodosSet.add(horarioKey);
      }
    });

    // Agrupar días por si tienen o no horarios existentes
    const diasConHorarios: number[] = [];
    const diasSinHorarios: number[] = [];
    
    // Obtener horarios nuevos y existentes dentro del rango seleccionado
    const horariosNuevosSet = new Set<string>();
    const horariosExistentesEnRangoSet = new Set<string>();
    
    fechas.forEach(fecha => {
      const fechaKey = this.utils.getDateKey(fecha);
      const diaNumero = fecha.getDate();
      let tieneHorarios = false;
      
      for (let hora = inicio; hora < fin; hora++) {
        const horaInicioStr = `${hora.toString().padStart(2, '0')}:00`;
        const horaFinStr = `${(hora + 1).toString().padStart(2, '0')}:00`;
        const horarioKey = `${horaInicioStr}-${horaFinStr}`;
        
        // Verificar si este horario ya existe para esta fecha específica
        const horarioExiste = horariosExistentesData.some(h => {
          const fechaH = this.utils.toDate(h.fecha);
          const horaInicioH = this.utils.toDate(h.horaInicio);
          const fechaHKey = this.utils.getDateKey(fechaH);
          const horaInicioHHora = horaInicioH.getHours();
          return fechaHKey === fechaKey && horaInicioHHora === hora;
        });
        
        if (horarioExiste) {
          tieneHorarios = true;
          horariosExistentesEnRangoSet.add(horarioKey);
        } else {
          horariosNuevosSet.add(horarioKey);
        }
      }
      
      if (tieneHorarios) {
        diasConHorarios.push(diaNumero);
      } else {
        diasSinHorarios.push(diaNumero);
      }
    });

    // Convertir sets a arrays ordenados
    const horariosNuevos = Array.from(horariosNuevosSet).sort().map(key => {
      const [horaInicioStr, horaFinStr] = key.split('-');
      return { horaInicioStr, horaFinStr };
    });
    
    // Mostrar TODOS los horarios existentes, no solo los del rango
    const horariosExistentesList = Array.from(horariosExistentesTodosSet).sort().map(key => {
      const [horaInicioStr, horaFinStr] = key.split('-');
      return { horaInicioStr, horaFinStr };
    });

    // Calcular totales
    const totalHorariosNuevos = horariosNuevos.length * (diasConHorarios.length + diasSinHorarios.length);
    const totalHorariosExistentes = horariosExistentesList.length * diasConHorarios.length;

    return {
      dias: diasFormateados,
      diasCount: fechas.length,
      diasConHorarios: diasConHorarios.sort((a, b) => a - b),
      diasSinHorarios: diasSinHorarios.sort((a, b) => a - b),
      horariosNuevos,
      horariosExistentes: horariosExistentesList,
      totalHorariosNuevos,
      totalHorariosExistentes,
      capacidad
    };
  });

  totalHorariosACrear = computed(() => {
    const vistaPrevia = this.vistaPreviaHorarios();
    if (!vistaPrevia) return 0;
    // Calcular correctamente: horarios nuevos * días sin horarios + horarios nuevos * días con horarios (solo los que no existen)
    return vistaPrevia.horariosNuevos.length * vistaPrevia.diasCount;
  });

  constructor() {
    this.cargarDatos();
  }

  async cargarDatos() {
    try {
      const horarios = await firstValueFrom(this.horariosService.getHorarios$());
      this.horarios.set(horarios);
      
      const reservasData = horarios.flatMap(h => 
        (h.reservas || []).map(reserva => ({
          ...reserva,
          horarioDisponible: h
        }))
      );
      this.reservas.set(reservasData);
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al cargar los horarios';
      this.toast.error(mensaje);
    }
  }

  onFechaSeleccionada(fecha: Date | null) {
    this.fechaSeleccionada.set(fecha);
    // Solo recargar si realmente cambió la fecha y no es solo un cambio de selección
    if (fecha) {
      // No recargar datos, solo actualizar la vista filtrada
    }
  }

  onTabChange(tabIndex: number) {
    this.activeTab.set(tabIndex);
    // Solo recargar datos si es necesario (cuando se cambia a la pestaña de tutorías)
    if (tabIndex === 2 && this.fechaSeleccionada()) {
      // Los datos ya están cargados, no es necesario recargar
    }
  }

  limpiarFiltroFecha() {
    this.fechaSeleccionada.set(null);
  }

  onFechasSeleccionadas(fechas: Date[]) {
    if (this.activeTab() === 0) {
      // Filtrar días pasados solo en la pestaña de establecer horarios
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechasFiltradas = fechas.filter(fecha => {
        const fechaComparar = new Date(fecha);
        fechaComparar.setHours(0, 0, 0, 0);
        return fechaComparar >= hoy;
      });
      
      // Para la pestaña de establecer horarios
      this.fechasSeleccionadasHorarios.set(fechasFiltradas);
      // Cargar horarios existentes cuando cambian las fechas
      this.cargarHorariosExistentes(fechasFiltradas);
    }
  }

  cargarHorariosExistentes(fechas: Date[]) {
    if (fechas.length === 0) {
      this.horariosExistentes.set([]);
      return;
    }

    const horariosFiltrados = this.horarios().filter(horario => {
      const fechaHorario = this.utils.toDate(horario.fecha);
      return fechas.some(fecha => this.utils.getDateKey(fechaHorario) === this.utils.getDateKey(fecha));
    });

    this.horariosExistentes.set(horariosFiltrados);
    
    if (horariosFiltrados.length > 0) {
      const primerHorario = horariosFiltrados[0];
      const horaInicioDate = this.utils.toDate(primerHorario.horaInicio);
      const horaFinDate = this.utils.toDate(primerHorario.horaFin);
      this.horaInicio.set(horaInicioDate.getHours());
      this.horaFin.set(horaFinDate.getHours());
      this.capacidad.set(primerHorario.capacidad);
    }
  }

  desmarcarTodasLasFechas() {
    this.fechasSeleccionadasHorarios.set([]);
  }

  establecerHorarios = async () => {
    const fechas = this.fechasSeleccionadasHorarios();
    if (fechas.length === 0) {
      this.toast.warning('Selecciona al menos una fecha en el calendario');
      return;
    }

    const horariosExistentes = this.horariosExistentes();
    const horariosNuevos: any[] = [];

    // Solo crear nuevos horarios, NO actualizar existentes automáticamente
    fechas.forEach(fecha => {
      for (let hora = this.horaInicio(); hora < this.horaFin(); hora++) {
        const horaInicio = new Date(fecha);
        horaInicio.setHours(hora, 0, 0, 0);
        
        const horaFin = new Date(fecha);
        horaFin.setHours(hora + 1, 0, 0, 0);

        const fechaKey = this.utils.getDateKey(fecha);
        
        const yaExiste = horariosExistentes.some(h => {
          const fechaH = this.utils.toDate(h.fecha);
          const horaInicioH = this.utils.toDate(h.horaInicio);
          const fechaHKey = this.utils.getDateKey(fechaH);
          const horaInicioHHora = horaInicioH.getHours();
          return fechaHKey === fechaKey && horaInicioHHora === hora;
        });
        
        if (!yaExiste) {
          horariosNuevos.push({
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
            horaInicio,
            horaFin,
            capacidad: this.capacidad(),
            descripcion: this.descripcionHorarios() || undefined
          });
        }
      }
    });

    if (horariosNuevos.length > 0) {
      await firstValueFrom(this.horariosService.generarHorarios$(horariosNuevos));
      this.toast.success(`${horariosNuevos.length} horario(s) creado(s) correctamente`);
      this.fechasSeleccionadasHorarios.set([]);
      this.horariosExistentes.set([]);
      this.horariosSeleccionadosEliminar.set([]);
      this.descripcionHorarios.set('');
      await this.cargarDatos();
    } else {
      this.toast.info('Todos los horarios para ese rango ya existen. Usa el botón "Editar" en la tabla para modificar horarios existentes.');
    }
  }

  abrirDialogEditar(horario: HorarioDisponible) {
    // No permitir editar horarios pasados
    if (this.utils.esHorarioPasado(horario)) {
      this.toast.warning('No se pueden editar horarios pasados. Solo se pueden eliminar o consultar.');
      return;
    }
    
    const horaInicioDate = this.utils.toDate(horario.horaInicio);
    const horaFinDate = this.utils.toDate(horario.horaFin);
    this.horarioEditando.set(horario);
    this.horarioEditHoraInicio.set(horaInicioDate.getHours());
    this.horarioEditHoraFin.set(horaFinDate.getHours());
    this.horarioEditCapacidad.set(horario.capacidad);
    this.horarioEditDescripcion.set(horario.descripcion || '');
    this.mostrarDialogEditar.set(true);
  }

  guardarHorarioEditado = async () => {
    const horario = this.horarioEditando();
    if (!horario) return;

    const horaInicio = this.horarioEditHoraInicio();
    const horaFin = this.horarioEditHoraFin();
    const capacidad = this.horarioEditCapacidad();

    // Validar que las horas sean secuenciales (horaFin = horaInicio + 1)
    if (horaFin !== horaInicio + 1) {
      this.toast.warning('La hora de fin debe ser exactamente una hora después de la hora de inicio (horarios secuenciales)');
      return;
    }

    // Validar que no sean horas anteriores
    const fecha = this.utils.toDate(horario.fecha);
    const ahora = new Date();
    const fechaHoraInicio = new Date(fecha);
    fechaHoraInicio.setHours(horaInicio, 0, 0, 0);
    
    if (fechaHoraInicio < ahora) {
      this.toast.warning('No se pueden establecer horarios en el pasado');
      return;
    }

    const horaInicioDate = new Date(fecha);
    horaInicioDate.setHours(horaInicio, 0, 0, 0);
    
    const horaFinDate = new Date(fecha);
    horaFinDate.setHours(horaFin, 0, 0, 0);

    try {
      await firstValueFrom(this.horariosService.updateHorarios$([{
        id: horario.id,
        fecha: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
        horaInicio: horaInicioDate,
        horaFin: horaFinDate,
        capacidad: capacidad,
        estado: horario.estado,
        descripcion: this.horarioEditDescripcion() || undefined
      }]));
      
      this.toast.success('Horario actualizado correctamente');
      this.mostrarDialogEditar.set(false);
      this.horarioEditando.set(null);
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al actualizar horario';
      this.toast.error(mensaje);
    }
  }

  toggleHorarioEliminar(horarioId: number) {
    const seleccionados = this.horariosSeleccionadosEliminar();
    if (seleccionados.includes(horarioId)) {
      this.horariosSeleccionadosEliminar.set(seleccionados.filter(id => id !== horarioId));
    } else {
      this.horariosSeleccionadosEliminar.set([...seleccionados, horarioId]);
    }
  }

  toggleTodosHorariosEliminar() {
    const horariosFiltrados = this.horariosFiltrados();
    const seleccionados = this.horariosSeleccionadosEliminar();
    
    if (seleccionados.length === horariosFiltrados.length && horariosFiltrados.length > 0) {
      this.horariosSeleccionadosEliminar.set([]);
    } else {
      this.horariosSeleccionadosEliminar.set(horariosFiltrados.map(h => h.id));
    }
  }

  confirmarEliminarHorario(horario: HorarioDisponible) {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar el horario del ${this.utils.toDate(horario.fecha).toLocaleDateString('es-ES')} de ${this.utils.formatTime(horario.horaInicio)} a ${this.utils.formatTime(horario.horaFin)}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await firstValueFrom(this.horariosService.deleteHorario$(horario.id));
          this.toast.success('Horario eliminado correctamente');
          await this.cargarDatos();
        } catch (error: any) {
          const mensaje = error?.error?.message || 'Error al eliminar horario';
          this.toast.error(mensaje);
        }
      }
    });
  }

  eliminarHorariosSeleccionados = async () => {
    const seleccionados = this.horariosSeleccionadosEliminar();
    if (seleccionados.length === 0) {
      this.toast.warning('Selecciona al menos un horario para eliminar');
      return;
    }

    try {
      for (const horarioId of seleccionados) {
        await firstValueFrom(this.horariosService.deleteHorario$(horarioId));
      }
      this.toast.success(`${seleccionados.length} horario(s) eliminado(s) correctamente`);
      this.horariosSeleccionadosEliminar.set([]);
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al eliminar horarios';
      this.toast.error(mensaje);
    }
  }

  eliminarHorariosPasados = async () => {
    try {
      const resultado = await firstValueFrom(this.horariosService.deleteHorariosPasados$());
      this.toast.success(resultado.message || 'Horarios pasados eliminados correctamente');
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al eliminar horarios pasados';
      this.toast.error(mensaje);
    }
  }

  puedeCancelarReserva(reserva: Reserva): boolean {
    return this.utils.puedeCancelarReserva(reserva);
  }

  puedeConfirmarReserva(reserva: Reserva): boolean {
    return reserva.estado !== EstadoReserva.CONFIRMADA &&
           reserva.estado !== EstadoReserva.COMPLETADA && 
           reserva.estado !== EstadoReserva.AUSENTE && 
           reserva.estado !== EstadoReserva.CANCELADA;
  }

  puedeCambiarEstado(reserva: Reserva): boolean {
    return reserva.estado !== EstadoReserva.COMPLETADA && 
           reserva.estado !== EstadoReserva.AUSENTE && 
           reserva.estado !== EstadoReserva.CANCELADA;
  }

  toggleReservaSeleccionada(reservaId: number) {
    const reserva = this.reservasDelDiaFiltradas().find(r => r.id === reservaId);
    if (!reserva || !this.puedeCambiarEstado(reserva)) {
      return;
    }

    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.includes(reservaId)) {
      this.reservasSeleccionadas.set(seleccionadas.filter(id => id !== reservaId));
    } else {
      this.reservasSeleccionadas.set([...seleccionadas, reservaId]);
    }
  }

  toggleTodasLasReservas() {
    const reservasDelDia = this.reservasDelDiaFiltradas();
    const reservasCambiables = reservasDelDia.filter(r => this.puedeCambiarEstado(r));
    const seleccionadas = this.reservasSeleccionadas();
    
    const todasCambiablesSeleccionadas = reservasCambiables.length > 0 && 
      reservasCambiables.every(r => seleccionadas.includes(r.id));
    
    if (todasCambiablesSeleccionadas) {
      this.reservasSeleccionadas.set([]);
    } else {
      this.reservasSeleccionadas.set(reservasCambiables.map(r => r.id));
    }
  }

  confirmarReservas = async () => {
    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.length === 0) {
      this.toast.warning('Selecciona al menos una reserva');
      return;
    }

    const reservasDelDia = this.reservasDelDiaFiltradas();
    const reservasAConfirmar = seleccionadas.filter(id => {
      const reserva = reservasDelDia.find(r => r.id === id);
      return reserva && this.puedeConfirmarReserva(reserva);
    });

    if (reservasAConfirmar.length === 0) {
      this.toast.warning('Las reservas seleccionadas ya están confirmadas o no pueden ser confirmadas');
      this.reservasSeleccionadas.set([]);
      return;
    }

    if (reservasAConfirmar.length < seleccionadas.length) {
      this.toast.info(`Solo ${reservasAConfirmar.length} de ${seleccionadas.length} reservas seleccionadas pueden ser confirmadas`);
    }

    const mensaje = reservasAConfirmar.length === 1
      ? '¿Estás seguro de que deseas confirmar esta reserva?'
      : `¿Estás seguro de que deseas confirmar ${reservasAConfirmar.length} reservas?`;

    return new Promise<void>((resolve, reject) => {
      this.confirmationService.confirm({
        message: mensaje,
        header: 'Confirmar reservas',
        icon: 'pi pi-exclamation-triangle',
        acceptIcon: 'none',
        acceptLabel: 'Sí',
        rejectLabel: 'No',
        rejectIcon: 'none',
        rejectButtonStyleClass: 'p-button-text',
        accept: async () => {
          try {
            await this.ejecutarConfirmacionReservas(reservasAConfirmar);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        reject: () => {
          reject(new Error('Operación cancelada'));
        },
      });
    });
  }

  private ejecutarConfirmacionReservas = async (reservasAConfirmar: number[]) => {
    try {
      for (const reservaId of reservasAConfirmar) {
        const dto: UpdateEstadoReservaDto = {
          reservaId,
          estado: EstadoReserva.CONFIRMADA
        };
        await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      }
      this.toast.success(`${reservasAConfirmar.length} reserva(s) confirmada(s) correctamente`);
      this.reservasSeleccionadas.set([]);
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al confirmar reservas';
      this.toast.error(mensaje);
    }
  }

  abrirDialogCancelacion() {
    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.length === 0) {
      this.toast.warning('Selecciona al menos una reserva');
      return;
    }

    // Filtrar solo las reservas que pueden ser canceladas
    const reservasDelDia = this.reservasDelDiaFiltradas();
    const reservasCancelables = seleccionadas.filter(id => {
      const reserva = reservasDelDia.find(r => r.id === id);
      return reserva && this.puedeCancelarReserva(reserva);
    });

    if (reservasCancelables.length === 0) {
      this.toast.warning('Las reservas seleccionadas no pueden ser canceladas (ya están completadas, ausentes o canceladas)');
      this.reservasSeleccionadas.set([]);
      return;
    }

    if (reservasCancelables.length < seleccionadas.length) {
      this.toast.info(`Solo ${reservasCancelables.length} de ${seleccionadas.length} reservas seleccionadas pueden ser canceladas`);
    }

    this.reservasACancelar.set(reservasCancelables);
    this.mostrarDialogCancelacion.set(true);
    this.motivoCancelacion.set('');
  }

  cancelarReservas = async () => {
    const reservasIds = this.reservasACancelar();
    const motivo = this.motivoCancelacion();

    if (!motivo.trim()) {
      this.toast.warning('Ingresa un motivo de cancelación');
      return;
    }

    const reservasDelDia = this.reservasDelDiaFiltradas();
    const reservasACancelar = reservasIds.filter(id => {
      const reserva = reservasDelDia.find(r => r.id === id);
      return reserva && reserva.estado !== EstadoReserva.CANCELADA && this.puedeCancelarReserva(reserva);
    });

    if (reservasACancelar.length === 0) {
      this.toast.warning('Las reservas seleccionadas ya están canceladas o no pueden ser canceladas');
      this.mostrarDialogCancelacion.set(false);
      this.reservasSeleccionadas.set([]);
      this.motivoCancelacion.set('');
      return;
    }

    if (reservasACancelar.length < reservasIds.length) {
      this.toast.info(`Solo ${reservasACancelar.length} de ${reservasIds.length} reservas seleccionadas pueden ser canceladas`);
    }

    try {
      for (const reservaId of reservasACancelar) {
        const dto: UpdateEstadoReservaDto = {
          reservaId,
          estado: EstadoReserva.CANCELADA,
          motivoCancelacion: motivo
        };
        await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      }
      this.toast.success(`${reservasACancelar.length} reserva(s) cancelada(s) correctamente`);
      this.mostrarDialogCancelacion.set(false);
      this.reservasSeleccionadas.set([]);
      this.motivoCancelacion.set('');
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al cancelar reservas';
      this.toast.error(mensaje);
    }
  }

  getDisponibles(horario: HorarioDisponible): number {
    return this.utils.getDisponibles(horario);
  }

  getEstadoLabel(estado: EstadoReserva): string {
    return this.utils.getEstadoLabel(estado);
  }

  getEstadoTooltip(estado: EstadoReserva): string {
    switch (estado) {
      case EstadoReserva.PENDIENTE:
        return 'La reserva está pendiente de confirmación por el administrador';
      case EstadoReserva.CONFIRMADA:
        return 'La reserva ha sido confirmada. Puedes marcarla como completada o ausente';
      case EstadoReserva.COMPLETADA:
        return 'La reserva ha sido completada. El alumno asistió a la tutoría';
      case EstadoReserva.AUSENTE:
        return 'La reserva está marcada como ausente. El alumno no asistió a la tutoría';
      case EstadoReserva.CANCELADA:
        return 'La reserva ha sido cancelada. No se puede modificar su estado';
      default:
        return '';
    }
  }

  getTooltipAccionReserva(reserva: Reserva): string {
    if (reserva.estado === EstadoReserva.COMPLETADA) {
      return 'Esta reserva ya está marcada como completada. No se puede modificar';
    }
    if (reserva.estado === EstadoReserva.AUSENTE) {
      return 'Esta reserva ya está marcada como ausente. No se puede modificar';
    }
    if (reserva.estado === EstadoReserva.CANCELADA) {
      return 'Esta reserva está cancelada. No se pueden realizar acciones sobre ella';
    }
    if (reserva.estado === EstadoReserva.PENDIENTE) {
      return 'Primero debes confirmar la reserva antes de marcarla como completada o ausente';
    }
    return '';
  }

  getTooltipCheckboxReserva(reserva: Reserva): string {
    if (reserva.estado === EstadoReserva.COMPLETADA) {
      return 'No se puede seleccionar una reserva completada';
    }
    if (reserva.estado === EstadoReserva.AUSENTE) {
      return 'No se puede seleccionar una reserva marcada como ausente';
    }
    if (reserva.estado === EstadoReserva.CANCELADA) {
      return 'No se puede seleccionar una reserva cancelada';
    }
    return '';
  }

  esHorarioPasado(horario: HorarioDisponible): boolean {
    return this.utils.esHorarioPasado(horario);
  }

  marcarReservaCompletada = async (reservaId: number) => {
    try {
      const dto: UpdateEstadoReservaDto = {
        reservaId,
        estado: EstadoReserva.COMPLETADA
      };
      await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      this.toast.success('Reserva marcada como completada');
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al marcar la reserva como completada';
      this.toast.error(mensaje);
    }
  }

  marcarReservaAusente = async (reservaId: number) => {
    try {
      const dto: UpdateEstadoReservaDto = {
        reservaId,
        estado: EstadoReserva.AUSENTE
      };
      await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      this.toast.success('Reserva marcada como ausente');
      await this.cargarDatos();
    } catch (error: any) {
      const mensaje = error?.error?.message || 'Error al marcar la reserva como ausente';
      this.toast.error(mensaje);
    }
  }

  getMarcarCompletadaAction(reservaId: number) {
    return async () => {
      const reserva = this.reservasDelDiaFiltradas().find(r => r.id === reservaId);
      if (!reserva) {
        this.toast.error('Reserva no encontrada');
        return;
      }
      if (reserva.estado !== EstadoReserva.CONFIRMADA) {
        this.toast.warning('Solo se pueden marcar como completadas las reservas confirmadas');
        return;
      }
      await this.marcarReservaCompletada(reservaId);
    };
  }

  getMarcarAusenteAction(reservaId: number) {
    return async () => {
      const reserva = this.reservasDelDiaFiltradas().find(r => r.id === reservaId);
      if (!reserva) {
        this.toast.error('Reserva no encontrada');
        return;
      }
      if (reserva.estado !== EstadoReserva.CONFIRMADA) {
        this.toast.warning('Solo se pueden marcar como ausentes las reservas confirmadas');
        return;
      }
      await this.marcarReservaAusente(reservaId);
    };
  }

  onFiltersChangedHorarios(where: any) {
    if (where?.mostrarPasados !== undefined) {
      this.mostrarHorariosPasados.set(where.mostrarPasados);
    }
  }

  onFiltersChangedReservas(where: any) {
    if (where?.busqueda !== undefined) {
      this.busquedaAlumno.set(where.busqueda || '');
    }
  }

}

