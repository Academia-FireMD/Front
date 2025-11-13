import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule } from 'primeng/table';
import { ToastrService } from 'ngx-toastr';
import { CalendarioHorariosComponent, DiaEstado } from '../calendario-horarios/calendario-horarios.component';
import { HorariosService } from '../../servicios/horarios.service';
import { UserService } from '../../../services/user.service';
import { HorarioDisponible, Usuario } from '../../models/horario.model';

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
        TableModule,
        CalendarioHorariosComponent
    ]
})
export class HorariosAlumnoComponent {
    horariosService = inject(HorariosService);
    userService = inject(UserService);
    toast = inject(ToastrService);

    horariosDisponibles = signal<HorarioDisponible[]>([]);
    todosLosProfesoresDisponibles = signal<Usuario[]>([]);
    fechaSeleccionada = signal<Date | null>(null);
    horariosSeleccionados: number[] = [];

    diasEstados = computed(() => {
        const horariosData = this.horariosDisponibles();
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
            
            // Calcular disponibles restando las reservas activas
            const reservasActivas = (horario.reservas || []).filter(
                r => r.estado !== 'CANCELADA'
            ).length;
            dia.disponibles += horario.capacidad - reservasActivas;
        });

        diasMap.forEach((valor, fechaKey) => {
            const fecha = this.parseDateKey(fechaKey);
            let estado: DiaEstado['estado'] = 'sin-datos';

            if (valor.disponibles === valor.total && valor.total > 0) {
                estado = 'disponible';
            } else if (valor.disponibles > 0) {
                estado = 'parcial';
            } else if (valor.total > 0) {
                estado = 'completo';
            }

            estados.push({ fecha, estado });
        });

        return estados;
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

        // Agregar los horarios del día seleccionado a los profesores correspondientes
        const horariosDelDia = this.horariosDisponibles().filter(horario => {
            const fechaHorario = this.toDate(horario.fecha);
            return this.getDateKey(fechaHorario) === this.getDateKey(fecha);
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
                const horaInicioA = this.toDate(a.horaInicio).getTime();
                const horaInicioB = this.toDate(b.horaInicio).getTime();
                return horaInicioA - horaInicioB;
            })
        }));
    });

    todosLosHorariosDelDia = computed(() => {
        const fecha = this.fechaSeleccionada();
        if (!fecha) return [];

        const horariosDelDia = this.horariosDisponibles().filter(horario => {
            const fechaHorario = this.toDate(horario.fecha);
            return this.getDateKey(fechaHorario) === this.getDateKey(fecha);
        });

        return horariosDelDia.sort((a, b) => {
            const horaInicioA = this.toDate(a.horaInicio).getTime();
            const horaInicioB = this.toDate(b.horaInicio).getTime();
            return horaInicioA - horaInicioB;
        });
    });


    constructor() {
        this.cargarDatos();
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
        } catch (error) {
            this.toast.error('Error al cargar los datos');
        }
    }

    onFechaSeleccionada(fecha: Date | null) {
        this.fechaSeleccionada.set(fecha);
        this.horariosSeleccionados = [];
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

    async crearReserva() {
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
            this.cargarDatos();
        } catch (error: any) {
            this.toast.error(error?.error?.message || 'Error al crear la reserva');
        }
    }

    getDisponibles(horario: HorarioDisponible): number {
        const reservasActivas = (horario.reservas || []).filter(
            r => r.estado !== 'CANCELADA'
        ).length;
        return horario.capacidad - reservasActivas;
    }

    toDate(date: Date | string): Date {
        if (date instanceof Date) {
            return date;
        }
        return new Date(date);
    }

    formatTime(date: Date | string): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    getHorarioLabel(horario: HorarioDisponible): string {
        return `${this.formatTime(horario.horaInicio)} - ${this.formatTime(horario.horaFin)}`;
    }

    private getDateKey(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    private parseDateKey(key: string): Date {
        const [year, month, day] = key.split('-').map(Number);
        return new Date(year, month, day);
    }
}

