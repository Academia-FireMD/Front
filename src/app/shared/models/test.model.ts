import { Pregunta } from "./pregunta.model";
import { Usuario } from "./user.model";

export interface Test{
  id: number;
  realizadorId: number;
  realizador: Usuario;
  preguntas: Pregunta[];
}
