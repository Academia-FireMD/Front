import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { ToastrService } from 'ngx-toastr';
import { CalendarioHorariosComponent, DiaEstado } from '../calendario-horarios/calendario-horarios.component';
import { HorariosService } from '../../servicios/horarios.service';
import {
  EstadoReserva,
  HorarioDisponible,
  Reserva,
  UpdateEstadoReservaDto
} from '../../models/horario.model';

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
    InputNumberModule,
    InputTextareaModule,
    TableModule,
    TabViewModule,
    TooltipModule,
    CalendarioHorariosComponent
  ]
})
export class HorariosAdminComponent {
  horariosService = inject(HorariosService);
  toast = inject(ToastrService);

  horarios = signal<HorarioDisponible[]>([]);
  reservas = signal<Reserva[]>([]);
  horaInicio = signal<number>(0);
  horaFin = signal<number>(23);
  capacidad = signal<number>(1);
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

  horas = Array.from({ length: 24 }, (_, i) => ({ label: `${i.toString().padStart(2, '0')}:00`, value: i }));

  diasEstados = computed(() => {
    const horariosData = this.horarios();
    const reservasData = this.reservas();
    const estados: DiaEstado[] = [];
    const diasMap = new Map<string, { total: number; disponibles: number }>();

    horariosData.forEach(horario => {
      const fecha = this.toDate(horario.fecha);
      const fechaKey = this.getDateKey(fecha);
      if (!diasMap.has(fechaKey)) {
        diasMap.set(fechaKey, { total: 0, disponibles: 0 });
      }
      const dia = diasMap.get(fechaKey)!;
      dia.total += horario.capacidad;
      dia.disponibles += horario.capacidad;
    });

    reservasData.forEach(reserva => {
      if (reserva.horarioDisponible && reserva.estado !== EstadoReserva.CANCELADA) {
        const fecha = this.toDate(reserva.horarioDisponible.fecha);
        const fechaKey = this.getDateKey(fecha);
        if (diasMap.has(fechaKey)) {
          diasMap.get(fechaKey)!.disponibles--;
        }
      }
    });

    diasMap.forEach((valor, fechaKey) => {
      const fecha = this.parseDateKey(fechaKey);
      let estado: DiaEstado['estado'] = 'sin-datos';
      
      if (valor.disponibles === valor.total) {
        estado = 'disponible';
      } else if (valor.disponibles > 0) {
        estado = 'parcial';
      } else {
        estado = 'completo';
      }
      
      estados.push({ fecha, estado });
    });

    return estados;
  });

  reservasDelDia = computed(() => {
    const fecha = this.fechaSeleccionada();
    if (!fecha) return [];
    
    return this.reservas().filter(reserva => {
      if (!reserva.horarioDisponible) return false;
      const fechaReserva = this.toDate(reserva.horarioDisponible.fecha);
      return this.getDateKey(fechaReserva) === this.getDateKey(fecha);
    });
  });

  horariosFiltrados = computed(() => {
    const fecha = this.fechaSeleccionada();
    const todosHorarios = this.horarios();
    
    if (!fecha) {
      return todosHorarios; // Si no hay fecha seleccionada, mostrar todos
    }
    
    return todosHorarios.filter(horario => {
      const fechaHorario = this.toDate(horario.fecha);
      return this.getDateKey(fechaHorario) === this.getDateKey(fecha);
    });
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
    } catch (error) {
      this.toast.error('Error al cargar los horarios');
    }
  }

  onFechaSeleccionada(fecha: Date | null) {
    // Actualizar la fecha seleccionada para todas las pestañas
    this.fechaSeleccionada.set(fecha);
    // Recargar datos para ver las reservas actualizadas
    this.cargarDatos();
  }

  onTabChange(tabIndex: number) {
    this.activeTab.set(tabIndex);
    // Recargar datos cuando se cambia a la pestaña de Tutorías
    if (tabIndex === 2) {
      this.cargarDatos();
    }
  }

  onFechasSeleccionadas(fechas: Date[]) {
    if (this.activeTab() === 0) {
      // Para la pestaña de establecer horarios
      this.fechasSeleccionadasHorarios.set(fechas);
      this.cargarHorariosExistentes(fechas);
    }
  }

  cargarHorariosExistentes(fechas: Date[]) {
    if (fechas.length === 0) {
      this.horariosExistentes.set([]);
      return;
    }

    // Filtrar horarios existentes para las fechas seleccionadas
    const horariosFiltrados = this.horarios().filter(horario => {
      const fechaHorario = this.toDate(horario.fecha);
      return fechas.some(fecha => this.getDateKey(fechaHorario) === this.getDateKey(fecha));
    });

    this.horariosExistentes.set(horariosFiltrados);
    
    // Si hay horarios existentes, precargar los valores
    if (horariosFiltrados.length > 0) {
      const primerHorario = horariosFiltrados[0];
      const horaInicioDate = this.toDate(primerHorario.horaInicio);
      const horaFinDate = this.toDate(primerHorario.horaFin);
      this.horaInicio.set(horaInicioDate.getHours());
      this.horaFin.set(horaFinDate.getHours());
      this.capacidad.set(primerHorario.capacidad);
    }
  }

  desmarcarTodasLasFechas() {
    this.fechasSeleccionadasHorarios.set([]);
    // También necesitamos limpiar el calendario
    // Esto se manejará a través del binding del componente calendario
  }

  async establecerHorarios() {
    const fechas = this.fechasSeleccionadasHorarios();
    if (fechas.length === 0) {
      this.toast.warning('Selecciona al menos una fecha en el calendario');
      return;
    }

    const horariosExistentes = this.horariosExistentes();
    const horariosNuevos: any[] = [];
    const horariosActualizar: any[] = [];
    const horariosActualizadosIds = new Set<number>(); // Para evitar duplicados

    // Solo crear nuevos horarios, NO actualizar existentes automáticamente
    fechas.forEach(fecha => {
      for (let hora = this.horaInicio(); hora <= this.horaFin(); hora++) {
        const horaInicio = new Date(fecha);
        horaInicio.setHours(hora, 0, 0, 0);
        
        const horaFin = new Date(fecha);
        horaFin.setHours(hora + 1, 0, 0, 0);

        const fechaKey = this.getDateKey(fecha);
        
        // Verificar si ya existe un horario con esa fecha y hora exacta
        const yaExiste = horariosExistentes.some(h => {
          const fechaH = this.toDate(h.fecha);
          const horaInicioH = this.toDate(h.horaInicio);
          const fechaHKey = this.getDateKey(fechaH);
          const horaInicioHHora = horaInicioH.getHours();
          return fechaHKey === fechaKey && horaInicioHHora === hora;
        });
        
        if (!yaExiste) {
          horariosNuevos.push({
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
            horaInicio,
            horaFin,
            capacidad: this.capacidad()
          });
        }
      }
    });

    try {
      if (horariosNuevos.length > 0) {
        await firstValueFrom(this.horariosService.generarHorarios$(horariosNuevos));
        this.toast.success(`${horariosNuevos.length} horario(s) creado(s) correctamente`);
      } else {
        this.toast.info('Todos los horarios para ese rango ya existen. Usa el botón "Editar" en la tabla para modificar horarios existentes.');
      }
      
      this.fechasSeleccionadasHorarios.set([]);
      this.horariosExistentes.set([]);
      this.horariosSeleccionadosEliminar.set([]);
      this.cargarDatos();
    } catch (error) {
      this.toast.error('Error al establecer horarios');
    }
  }

  abrirDialogEditar(horario: HorarioDisponible) {
    const horaInicioDate = this.toDate(horario.horaInicio);
    const horaFinDate = this.toDate(horario.horaFin);
    this.horarioEditando.set(horario);
    this.horarioEditHoraInicio.set(horaInicioDate.getHours());
    this.horarioEditHoraFin.set(horaFinDate.getHours());
    this.horarioEditCapacidad.set(horario.capacidad);
    this.mostrarDialogEditar.set(true);
  }

  async guardarHorarioEditado() {
    const horario = this.horarioEditando();
    if (!horario) return;

    const horaInicio = this.horarioEditHoraInicio();
    const horaFin = this.horarioEditHoraFin();
    const capacidad = this.horarioEditCapacidad();

    if (horaInicio >= horaFin) {
      this.toast.warning('La hora de inicio debe ser menor que la hora de fin');
      return;
    }

    const fecha = this.toDate(horario.fecha);
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
        estado: horario.estado
      }]));
      
      this.toast.success('Horario actualizado correctamente');
      this.mostrarDialogEditar.set(false);
      this.horarioEditando.set(null);
      this.cargarDatos();
      this.cargarHorariosExistentes(this.fechasSeleccionadasHorarios());
    } catch (error) {
      this.toast.error('Error al actualizar horario');
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
    const horariosExistentes = this.horariosExistentes();
    const seleccionados = this.horariosSeleccionadosEliminar();
    
    if (seleccionados.length === horariosExistentes.length) {
      this.horariosSeleccionadosEliminar.set([]);
    } else {
      this.horariosSeleccionadosEliminar.set(horariosExistentes.map(h => h.id));
    }
  }

  async eliminarHorariosSeleccionados() {
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
      this.cargarDatos();
      this.cargarHorariosExistentes(this.fechasSeleccionadasHorarios());
    } catch (error) {
      this.toast.error('Error al eliminar horarios');
    }
  }

  toggleReservaSeleccionada(reservaId: number) {
    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.includes(reservaId)) {
      this.reservasSeleccionadas.set(seleccionadas.filter(id => id !== reservaId));
    } else {
      this.reservasSeleccionadas.set([...seleccionadas, reservaId]);
    }
  }

  toggleTodasLasReservas() {
    const reservasDelDia = this.reservasDelDia();
    const seleccionadas = this.reservasSeleccionadas();
    
    if (seleccionadas.length === reservasDelDia.length) {
      this.reservasSeleccionadas.set([]);
    } else {
      this.reservasSeleccionadas.set(reservasDelDia.map(r => r.id));
    }
  }

  async confirmarReservas() {
    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.length === 0) {
      this.toast.warning('Selecciona al menos una reserva');
      return;
    }

    try {
      for (const reservaId of seleccionadas) {
        const dto: UpdateEstadoReservaDto = {
          reservaId,
          estado: EstadoReserva.CONFIRMADA
        };
        await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      }
      this.toast.success('Reservas confirmadas correctamente');
      this.reservasSeleccionadas.set([]);
      this.cargarDatos();
    } catch (error) {
      this.toast.error('Error al confirmar reservas');
    }
  }

  abrirDialogCancelacion() {
    const seleccionadas = this.reservasSeleccionadas();
    if (seleccionadas.length === 0) {
      this.toast.warning('Selecciona al menos una reserva');
      return;
    }
    this.reservasACancelar.set(seleccionadas);
    this.mostrarDialogCancelacion.set(true);
    this.motivoCancelacion.set('');
  }

  async cancelarReservas() {
    const reservasIds = this.reservasACancelar();
    const motivo = this.motivoCancelacion();

    if (!motivo.trim()) {
      this.toast.warning('Ingresa un motivo de cancelación');
      return;
    }

    try {
      for (const reservaId of reservasIds) {
        const dto: UpdateEstadoReservaDto = {
          reservaId,
          estado: EstadoReserva.CANCELADA,
          motivoCancelacion: motivo
        };
        await firstValueFrom(this.horariosService.actualizarEstadoReserva$(dto));
      }
      this.toast.success('Reservas canceladas correctamente');
      this.mostrarDialogCancelacion.set(false);
      this.reservasSeleccionadas.set([]);
      this.motivoCancelacion.set('');
      this.cargarDatos();
    } catch (error) {
      this.toast.error('Error al cancelar reservas');
    }
  }

  getDisponibles(horario: HorarioDisponible): number {
    const reservasActivas = (horario.reservas || []).filter(
      r => r.estado !== EstadoReserva.CANCELADA
    ).length;
    return horario.capacidad - reservasActivas;
  }

  getEstadoLabel(estado: EstadoReserva): string {
    const estados = {
      [EstadoReserva.PENDIENTE]: 'Pendiente',
      [EstadoReserva.CONFIRMADA]: 'Confirmada',
      [EstadoReserva.CANCELADA]: 'Cancelada',
      [EstadoReserva.COMPLETADA]: 'Completada',
      [EstadoReserva.AUSENTE]: 'Ausente'
    };
    return estados[estado] || estado;
  }

  private toDate(date: Date | string): Date {
    if (date instanceof Date) {
      return date;
    }
    return new Date(date);
  }

  private getDateKey(date: Date): string {
    const d = this.toDate(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  private parseDateKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month, day);
  }
}

