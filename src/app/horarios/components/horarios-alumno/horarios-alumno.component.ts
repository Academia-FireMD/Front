import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { AccordionModule } from 'primeng/accordion';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { BadgeModule } from 'primeng/badge';
import { ToastrService } from 'ngx-toastr';
import { CalendarioHorariosComponent, DiaEstado } from '../calendario-horarios/calendario-horarios.component';
import { HorariosService } from '../../servicios/horarios.service';
import { HorariosUtilsService } from '../../servicios/horarios-utils.service';
import { UserService } from '../../../services/user.service';
import { EstadoReserva, HorarioDisponible, Reserva, Usuario } from '../../models/horario.model';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';

interface HorarioPorProfesor {
    profesor: Usuario;
    horarios: HorarioDisponible[];
}

@Component({
    selector: 'app-horarios-alumno',
    templateUrl: './horarios-alumno.component.html',
    styleUrl: './horarios-alumno.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CalendarModule,
        CheckboxModule,
        DialogModule,
        InputTextareaModule,
        TooltipModule,
        DropdownModule,
        AccordionModule,
        InputTextModule,
        IconFieldModule,
        InputIconModule,
        BadgeModule,
        CalendarioHorariosComponent,
        AsyncButtonComponent
    ]
})
export class HorariosAlumnoComponent {
    horariosService = inject(HorariosService);
    utils = inject(HorariosUtilsService);
    userService = inject(UserService);
    toast = inject(ToastrService);
    
    EstadoReserva = EstadoReserva;

    horariosDisponibles = signal<HorarioDisponible[]>([]);
    todosLosProfesoresDisponibles = signal<Usuario[]>([]);
    fechaSeleccionada = signal<Date | null>(null);
    horariosSeleccionados: number[] = [];
    reservas = signal<Reserva[]>([]);
    mostrarDialogCancelacion = signal<boolean>(false);
    motivoCancelacion = signal<string>('');
    reservaACancelar = signal<number | null>(null);
    filtroEstado = signal<EstadoReserva | 'TODAS'>('TODAS');
    busquedaProfesor = signal<string>('');
    mostrarPasadas = signal<boolean>(false);

    esHorarioPasado(horario: HorarioDisponible): boolean {
        return this.utils.esHorarioPasado(horario);
    }

    diasEstados = computed(() => {
        return this.utils.calcularDiasEstados(this.horariosDisponibles(), [], true);
    });

    todosLosProfesores = computed(() => {
        // Usar los profesores cargados desde el endpoint de tutores
        // Esto asegura que tengamos todos los profesores aunque no tengan horarios activos
        return this.todosLosProfesoresDisponibles();
    });

    horariosPorProfesor = computed(() => {
        const fecha = this.fechaSeleccionada();
        
        // Si no hay fecha seleccionada, no retornar nada
        if (!fecha) {
            return [];
        }

        const map = new Map<number, HorarioPorProfesor>();
        const todosProfesores = this.todosLosProfesores();

        // Primero, crear entradas para TODOS los profesores (sin importar si tienen horarios ese día)
        todosProfesores.forEach(profesor => {
            map.set(profesor.id, {
                profesor: profesor,
                horarios: []
            });
        });

        const horariosDelDia = this.horariosDisponibles().filter(horario => {
            const fechaHorario = this.utils.toDate(horario.fecha);
            return this.utils.getDateKey(fechaHorario) === this.utils.getDateKey(fecha) && !this.esHorarioPasado(horario);
        });

        horariosDelDia.forEach(horario => {
            if (!horario.admin) return;

            const adminId = horario.admin.id;
            if (map.has(adminId)) {
                map.get(adminId)!.horarios.push(horario);
            }
        });

        return Array.from(map.values()).map(item => ({
            ...item,
            horarios: item.horarios.sort((a, b) => {
                const horaInicioA = this.utils.toDate(a.horaInicio).getTime();
                const horaInicioB = this.utils.toDate(b.horaInicio).getTime();
                return horaInicioA - horaInicioB;
            })
        }));
    });

    todosLosHorariosDelDia = computed(() => {
        const fecha = this.fechaSeleccionada();
        if (!fecha) return [];

        const horariosDelDia = this.horariosDisponibles().filter(horario => {
            const fechaHorario = this.utils.toDate(horario.fecha);
            return this.utils.getDateKey(fechaHorario) === this.utils.getDateKey(fecha) && !this.esHorarioPasado(horario);
        });

        return horariosDelDia.sort((a, b) => {
            const horaInicioA = this.utils.toDate(a.horaInicio).getTime();
            const horaInicioB = this.utils.toDate(b.horaInicio).getTime();
            return horaInicioA - horaInicioB;
        });
    });

    reservasFiltradas = computed(() => {
        let reservas = this.reservas();
        
        // Filtrar por estado
        if (this.filtroEstado() !== 'TODAS') {
            reservas = reservas.filter(r => r.estado === this.filtroEstado());
        }
        
        // Filtrar por búsqueda de profesor
        const busqueda = this.busquedaProfesor().toLowerCase().trim();
        if (busqueda) {
            reservas = reservas.filter(r => {
                const nombre = `${r.horarioDisponible?.admin?.nombre || ''} ${r.horarioDisponible?.admin?.apellidos || ''}`.toLowerCase();
                const email = (r.horarioDisponible?.admin?.email || '').toLowerCase();
                return nombre.includes(busqueda) || email.includes(busqueda);
            });
        }
        
        if (!this.mostrarPasadas()) {
            reservas = reservas.filter(r => !this.utils.esReservaPasada(r));
        }
        
        return reservas.sort((a, b) => {
            const fechaA = this.utils.toDate(a.horarioDisponible?.fecha || new Date()).getTime();
            const fechaB = this.utils.toDate(b.horarioDisponible?.fecha || new Date()).getTime();
            if (fechaA !== fechaB) return fechaA - fechaB;
            const horaA = this.utils.toDate(a.horarioDisponible?.horaInicio || new Date()).getTime();
            const horaB = this.utils.toDate(b.horarioDisponible?.horaInicio || new Date()).getTime();
            return horaA - horaB;
        });
    });

    reservasPendientes = computed(() => {
        return this.reservas().filter(r => 
            r.estado !== EstadoReserva.CANCELADA && 
            r.estado !== EstadoReserva.COMPLETADA
        ).sort((a, b) => {
            const fechaA = this.utils.toDate(a.horarioDisponible?.fecha || new Date()).getTime();
            const fechaB = this.utils.toDate(b.horarioDisponible?.fecha || new Date()).getTime();
            if (fechaA !== fechaB) return fechaA - fechaB;
            const horaA = this.utils.toDate(a.horarioDisponible?.horaInicio || new Date()).getTime();
            const horaB = this.utils.toDate(b.horarioDisponible?.horaInicio || new Date()).getTime();
            return horaA - horaB;
        });
    });

    contadoresReservas = computed(() => {
        const reservas = this.reservas();
        const ahora = new Date();
        
        return {
            todas: reservas.length,
            pendientes: reservas.filter(r => r.estado === EstadoReserva.PENDIENTE).length,
            confirmadas: reservas.filter(r => r.estado === EstadoReserva.CONFIRMADA).length,
            completadas: reservas.filter(r => r.estado === EstadoReserva.COMPLETADA).length,
            canceladas: reservas.filter(r => r.estado === EstadoReserva.CANCELADA).length,
            proximas: reservas.filter(r => {
                if (!r.horarioDisponible?.fecha || !r.horarioDisponible?.horaInicio) return false;
                return !this.utils.esReservaPasada(r) && 
                       r.estado !== EstadoReserva.CANCELADA && 
                       r.estado !== EstadoReserva.COMPLETADA;
            }).length
        };
    });

    reservasAgrupadasPorFecha = computed(() => {
        const reservas = this.reservasFiltradas();
        const grupos = new Map<string, Reserva[]>();
        
        reservas.forEach(reserva => {
            if (!reserva.horarioDisponible?.fecha) return;
            const fecha = this.utils.toDate(reserva.horarioDisponible.fecha);
            const fechaKey = fecha.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            if (!grupos.has(fechaKey)) {
                grupos.set(fechaKey, []);
            }
            grupos.get(fechaKey)!.push(reserva);
        });
        
        return Array.from(grupos.entries()).map(([fecha, reservas]) => ({
            fecha,
            reservas: reservas.sort((a, b) => {
                const horaA = this.utils.toDate(a.horarioDisponible?.horaInicio || new Date()).getTime();
                const horaB = this.utils.toDate(b.horarioDisponible?.horaInicio || new Date()).getTime();
                return horaA - horaB;
            })
        }));
    });

    opcionesEstado = computed(() => {
        const contadores = this.contadoresReservas();
        return [
            { label: `Todas (${contadores.todas})`, value: 'TODAS' as EstadoReserva | 'TODAS' },
            { label: `Pendientes (${contadores.pendientes})`, value: EstadoReserva.PENDIENTE },
            { label: `Confirmadas (${contadores.confirmadas})`, value: EstadoReserva.CONFIRMADA },
            { label: `Completadas (${contadores.completadas})`, value: EstadoReserva.COMPLETADA },
            { label: `Canceladas (${contadores.canceladas})`, value: EstadoReserva.CANCELADA }
        ];
    });

    getContador(estado: EstadoReserva | 'TODAS'): number {
        const contadores = this.contadoresReservas();
        switch (estado) {
            case 'TODAS':
                return contadores.todas;
            case EstadoReserva.PENDIENTE:
                return contadores.pendientes;
            case EstadoReserva.CONFIRMADA:
                return contadores.confirmadas;
            case EstadoReserva.COMPLETADA:
                return contadores.completadas;
            case EstadoReserva.CANCELADA:
                return contadores.canceladas;
            default:
                return 0;
        }
    }


    constructor() {
        this.cargarDatos();
        this.cargarReservas();
    }

    async cargarDatos() {
        try {
            // Cargar horarios y profesores en paralelo
            const [horarios, profesores] = await Promise.all([
                firstValueFrom(this.horariosService.getHorariosDisponibles$()),
                firstValueFrom(this.userService.getAllTutores$())
            ]);
            this.horariosDisponibles.set(horarios);
            this.todosLosProfesoresDisponibles.set(profesores);
        } catch (error: any) {
            const mensaje = error?.error?.message || 'Error al cargar los datos';
            this.toast.error(mensaje);
        }
    }

    async cargarReservas() {
        try{
            const reservas = await firstValueFrom(this.horariosService.getMisReservas$());
            this.reservas.set(reservas);
        }catch(error: any){
            const mensaje = error?.error?.message || 'Error al cargar las reservas';
            this.toast.error(mensaje);
        }
    }

    onFechaSeleccionada(fecha: Date | null) {
        this.fechaSeleccionada.set(fecha);
        this.horariosSeleccionados = [];
        // No recargar reservas innecesariamente, los datos ya están cargados
    }

    toggleHorarioSeleccionado(horarioId: number) {
        const index = this.horariosSeleccionados.indexOf(horarioId);
        if (index > -1) {
            this.horariosSeleccionados.splice(index, 1);
        } else {
            this.horariosSeleccionados.push(horarioId);
        }
    }

    isHorarioSeleccionado(horarioId: number): boolean {
        return this.horariosSeleccionados.includes(horarioId);
    }

    tieneHorario(profesorHorarios: HorarioDisponible[], horarioId: number): boolean {
        return profesorHorarios.some(h => h.id === horarioId);
    }

    tieneReservaActiva(horarioId: number): boolean {
        return this.reservas().some(r => 
            r.horarioDisponibleId === horarioId && 
            r.estado !== EstadoReserva.CANCELADA && 
            r.estado !== EstadoReserva.COMPLETADA
        );
    }

    crearReserva = async () => {
        if (this.horariosSeleccionados.length === 0) {
            this.toast.warning('Selecciona al menos un horario');
            return;
        }

        try {
            for (const horarioId of this.horariosSeleccionados) {
                await firstValueFrom(this.horariosService.reservarHorario$(horarioId));
            }
            this.toast.success('Reserva(s) creada(s) correctamente');
            this.horariosSeleccionados = [];
            await Promise.all([this.cargarDatos(), this.cargarReservas()]);
        } catch (error: any) {
            const mensaje = error?.error?.message || 'Error al crear la reserva';
            this.toast.error(mensaje);
        }
    }

    abrirDialogCancelacion(reservaId: number) {
        this.reservaACancelar.set(reservaId);
        this.motivoCancelacion.set('');
        this.mostrarDialogCancelacion.set(true);
    }

    cancelarReserva = async () => {
        const reservaId = this.reservaACancelar();
        const motivo = this.motivoCancelacion();

        if (!reservaId) {
            this.toast.warning('No se ha seleccionado una reserva');
            return;
        }

        const reserva = this.reservas().find(r => r.id === reservaId);
        if (reserva && !this.puedeCancelarReserva(reserva)) {
            this.toast.warning('No se puede cancelar una reserva que está completada o marcada como ausente');
            this.mostrarDialogCancelacion.set(false);
            this.motivoCancelacion.set('');
            this.reservaACancelar.set(null);
            return;
        }

        if (!motivo.trim()) {
            this.toast.warning('Ingresa un motivo de cancelación');
            return;
        }

        try {
            await firstValueFrom(this.horariosService.cancelarReservaAlumno$(reservaId, motivo));
            this.toast.success('Reserva cancelada correctamente');
            this.mostrarDialogCancelacion.set(false);
            this.motivoCancelacion.set('');
            this.reservaACancelar.set(null);
            await Promise.all([this.cargarReservas(), this.cargarDatos()]);
        } catch (error: any) {
            const mensaje = error?.error?.message || 'Error al cancelar la reserva';
            this.toast.error(mensaje);
        }
    }

    getEstadoLabel(estado: EstadoReserva): string {
        return this.utils.getEstadoLabel(estado);
    }

    getEstadoLabelFiltro(): string {
        const estado = this.filtroEstado();
        if (estado === 'TODAS') {
            return 'Todas';
        }
        return this.getEstadoLabel(estado);
    }

    getDisponibles(horario: HorarioDisponible): number {
        return this.utils.getDisponibles(horario);
    }

    getHorarioLabel(horario: HorarioDisponible): string {
        return this.utils.getHorarioLabel(horario);
    }

    cambiarFiltroEstado(estado: EstadoReserva | 'TODAS') {
        this.filtroEstado.set(estado);
    }


    limpiarFiltros() {
        this.filtroEstado.set('TODAS');
        this.busquedaProfesor.set('');
        this.mostrarPasadas.set(false);
        this.fechaSeleccionada.set(null);
    }

    tieneFiltrosActivos(): boolean {
        return this.filtroEstado() !== 'TODAS' || 
               this.busquedaProfesor().trim().length > 0 || 
               this.mostrarPasadas();
    }

    esReservaPasada(reserva: Reserva): boolean {
        return this.utils.esReservaPasada(reserva);
    }

    puedeCancelarReserva(reserva: Reserva): boolean {
        return this.utils.puedeCancelarReserva(reserva);
    }
}

