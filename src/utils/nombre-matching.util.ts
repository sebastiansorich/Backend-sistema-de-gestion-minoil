/**
 * Utilidades para matching y normalización de nombres entre SAP y el sistema local
 */

export class NombreMatchingUtil {
  
  /**
   * Normaliza un nombre removiendo acentos, espacios extra, y convirtiendo a minúsculas
   */
  static normalizar(nombre: string): string {
    if (!nombre) return '';
    
    return nombre
      .toLowerCase()
      .normalize('NFD') // Descompone los caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // Remueve los acentos
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios con uno solo
      .trim();
  }

  /**
   * Compara dos nombres normalizados para verificar si son exactamente iguales
   */
  static sonIguales(nombre1: string, nombre2: string): boolean {
    return this.normalizar(nombre1) === this.normalizar(nombre2);
  }

  /**
   * Calcula la distancia de Levenshtein entre dos strings
   */
  static calcularDistanciaLevenshtein(str1: string, str2: string): number {
    const a = this.normalizar(str1);
    const b = this.normalizar(str2);
    
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // Inserción
          matrix[j - 1][i] + 1, // Eliminación
          matrix[j - 1][i - 1] + cost // Sustitución
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Calcula el porcentaje de similitud entre dos nombres (0-100)
   */
  static calcularSimilitud(nombre1: string, nombre2: string): number {
    const distancia = this.calcularDistanciaLevenshtein(nombre1, nombre2);
    const longitudMaxima = Math.max(nombre1.length, nombre2.length);
    
    if (longitudMaxima === 0) return 100;
    
    return Math.round(((longitudMaxima - distancia) / longitudMaxima) * 100);
  }

  /**
   * Verifica si dos nombres son suficientemente similares (umbral por defecto 85%)
   */
  static sonSimilares(nombre1: string, nombre2: string, umbral: number = 85): boolean {
    return this.calcularSimilitud(nombre1, nombre2) >= umbral;
  }

  /**
   * Busca el mejor match para un nombre en una lista de candidatos
   */
  static encontrarMejorMatch(
    nombreBuscado: string, 
    candidatos: string[], 
    umbralMinimo: number = 80
  ): { match: string | null; similitud: number; indice: number } {
    
    let mejorMatch: string | null = null;
    let mejorSimilitud = 0;
    let mejorIndice = -1;

    candidatos.forEach((candidato, indice) => {
      const similitud = this.calcularSimilitud(nombreBuscado, candidato);
      
      if (similitud > mejorSimilitud && similitud >= umbralMinimo) {
        mejorMatch = candidato;
        mejorSimilitud = similitud;
        mejorIndice = indice;
      }
    });

    return {
      match: mejorMatch,
      similitud: mejorSimilitud,
      indice: mejorIndice
    };
  }

  /**
   * Intenta diferentes variaciones del nombre para hacer matching
   */
  static generarVariacionesNombre(nombreCompleto: string): string[] {
    const variaciones: string[] = [];
    const partes = nombreCompleto.trim().split(/\s+/);
    
    if (partes.length === 0) return variaciones;
    
    // Nombre completo original
    variaciones.push(nombreCompleto);
    
    if (partes.length >= 2) {
      // Primer nombre + primer apellido
      variaciones.push(`${partes[0]} ${partes[partes.length - 1]}`);
      
      // Solo primer nombre y segundo nombre (si existe)
      if (partes.length >= 2) {
        variaciones.push(`${partes[0]} ${partes[1]}`);
      }
      
      // Apellidos + primer nombre
      if (partes.length >= 3) {
        variaciones.push(`${partes[partes.length - 1]} ${partes[0]}`);
      }
      
      // Primer apellido + primer nombre
      if (partes.length >= 2) {
        variaciones.push(`${partes[partes.length - 1]} ${partes[0]}`);
      }
    }
    
    // Orden inverso completo
    variaciones.push(partes.reverse().join(' '));
    
    return [...new Set(variaciones)]; // Remover duplicados
  }

  /**
   * Busca un usuario por nombre con múltiples variaciones y estrategias
   */
  static buscarUsuarioPorNombre(
    nombreSap: string,
    usuariosSistema: { id: number; nombre: string; apellido: string; nombreCompleto?: string }[],
    umbralMinimo: number = 80
  ): { usuario: any | null; similitud: number; estrategia: string } {
    
    const variacionesSap = this.generarVariacionesNombre(nombreSap);
    let mejorMatch: any = null;
    let mejorSimilitud = 0;
    let estrategiaUsada = '';

    for (const usuario of usuariosSistema) {
      const nombreCompletoUsuario = usuario.nombreCompleto || `${usuario.nombre} ${usuario.apellido}`;
      const variacionesUsuario = this.generarVariacionesNombre(nombreCompletoUsuario);
      
      // Probar todas las combinaciones de variaciones
      for (const variacionSap of variacionesSap) {
        for (const variacionUsuario of variacionesUsuario) {
          const similitud = this.calcularSimilitud(variacionSap, variacionUsuario);
          
          if (similitud > mejorSimilitud && similitud >= umbralMinimo) {
            mejorMatch = usuario;
            mejorSimilitud = similitud;
            estrategiaUsada = `SAP: "${variacionSap}" vs Sistema: "${variacionUsuario}"`;
          }
        }
      }
    }

    return {
      usuario: mejorMatch,
      similitud: mejorSimilitud,
      estrategia: estrategiaUsada
    };
  }

  /**
   * Valida si un match es confiable basado en múltiples criterios
   */
  static esMatchConfiable(
    similitud: number,
    longitudNombreOriginal: number,
    estrategia: string
  ): { esConfiable: boolean; razon: string } {
    
    // Match exacto siempre es confiable
    if (similitud === 100) {
      return { esConfiable: true, razon: 'Match exacto' };
    }
    
    // Nombres muy cortos requieren mayor similitud
    if (longitudNombreOriginal <= 10 && similitud < 90) {
      return { 
        esConfiable: false, 
        razon: 'Nombre corto requiere mayor similitud (>90%)' 
      };
    }
    
    // Nombres largos pueden tolerar menor similitud
    if (longitudNombreOriginal > 20 && similitud >= 75) {
      return { esConfiable: true, razon: 'Nombre largo con similitud aceptable' };
    }
    
    // Similitud general alta
    if (similitud >= 85) {
      return { esConfiable: true, razon: 'Similitud alta' };
    }
    
    return { 
      esConfiable: false, 
      razon: `Similitud insuficiente (${similitud}%)` 
    };
  }

  // ============================================================================
  // 🔍 FUNCIONES ESPECÍFICAS PARA MATCHING LDAP-SAP
  // ============================================================================

  /**
   * Genera variaciones específicas para nombres de LDAP que pueden diferir de SAP
   */
  static generarVariacionesLDAP(nombreLDAP: string, apellidoLDAP: string): string[] {
    const variaciones: string[] = [];
    
    // Combinar nombre y apellido de diferentes maneras
    variaciones.push(`${nombreLDAP} ${apellidoLDAP}`);
    variaciones.push(`${apellidoLDAP} ${nombreLDAP}`);
    variaciones.push(`${apellidoLDAP}, ${nombreLDAP}`);
    variaciones.push(`${nombreLDAP} ${apellidoLDAP.split(' ')[0]}`); // Solo primer apellido
    
    // Si hay múltiples nombres o apellidos, generar más variaciones
    const nombresPartes = nombreLDAP.split(' ');
    const apellidosPartes = apellidoLDAP.split(' ');
    
    if (nombresPartes.length > 1) {
      // Solo primer nombre
      variaciones.push(`${nombresPartes[0]} ${apellidoLDAP}`);
      variaciones.push(`${apellidoLDAP} ${nombresPartes[0]}`);
    }
    
    if (apellidosPartes.length > 1) {
      // Combinaciones con múltiples apellidos
      variaciones.push(`${nombreLDAP} ${apellidosPartes[0]} ${apellidosPartes[1]}`);
      variaciones.push(`${apellidosPartes[0]} ${apellidosPartes[1]} ${nombreLDAP}`);
    }
    
    // Remover duplicados y normalizar
    return [...new Set(variaciones.map(v => v.trim()))].filter(v => v.length > 0);
  }

  /**
   * Busca coincidencias entre un usuario LDAP y empleados SAP
   */
  static buscarEmpleadoSAPPorUsuarioLDAP(
    nombreLDAP: string,
    apellidoLDAP: string,
    empleadosSAP: { empID: number; nombreCompletoSap: string }[],
    umbralMinimo: number = 75
  ): {
    empleado: any | null;
    similitud: number;
    estrategia: string;
    esConfiable: boolean;
    detalles: string;
  } {
    
    // Generar variaciones del nombre LDAP
    const variacionesLDAP = this.generarVariacionesLDAP(nombreLDAP, apellidoLDAP);
    
    let mejorMatch: any = null;
    let mejorSimilitud = 0;
    let mejorEstrategia = '';
    let detallesMatch = '';

    for (const empleado of empleadosSAP) {
      const nombreSAP = empleado.nombreCompletoSap;
      const variacionesSAP = this.generarVariacionesNombre(nombreSAP);
      
      // Probar todas las combinaciones
      for (const variacionLDAP of variacionesLDAP) {
        for (const variacionSAP of variacionesSAP) {
          const similitud = this.calcularSimilitud(variacionLDAP, variacionSAP);
          
          if (similitud > mejorSimilitud && similitud >= umbralMinimo) {
            mejorMatch = empleado;
            mejorSimilitud = similitud;
            mejorEstrategia = `LDAP: "${variacionLDAP}" vs SAP: "${variacionSAP}"`;
            detallesMatch = `Mejor match encontrado con ${similitud}% de similitud`;
          }
        }
      }

      // También probar match directo con tokens comunes
      const matchTokens = this.calcularSimilitudPorTokens(
        `${nombreLDAP} ${apellidoLDAP}`,
        nombreSAP
      );
      
      if (matchTokens.similitud > mejorSimilitud && matchTokens.similitud >= umbralMinimo) {
        mejorMatch = empleado;
        mejorSimilitud = matchTokens.similitud;
        mejorEstrategia = `Tokens comunes: ${matchTokens.tokensComunes.join(', ')}`;
        detallesMatch = `Match por tokens: ${matchTokens.tokensComunes.length} tokens en común`;
      }
    }

    // Evaluar confiabilidad del match
    const confiabilidad = this.esMatchConfiable(
      mejorSimilitud,
      `${nombreLDAP} ${apellidoLDAP}`.length,
      mejorEstrategia
    );

    return {
      empleado: mejorMatch,
      similitud: mejorSimilitud,
      estrategia: mejorEstrategia,
      esConfiable: confiabilidad.esConfiable,
      detalles: `${detallesMatch}. ${confiabilidad.razon}`
    };
  }

  /**
   * Calcula similitud basada en tokens/palabras comunes
   */
  static calcularSimilitudPorTokens(nombre1: string, nombre2: string): {
    similitud: number;
    tokensComunes: string[];
    totalTokens: number;
  } {
    const tokens1 = this.normalizar(nombre1).split(' ').filter(t => t.length > 1);
    const tokens2 = this.normalizar(nombre2).split(' ').filter(t => t.length > 1);
    
    const tokensComunes = tokens1.filter(token => 
      tokens2.some(t2 => this.calcularSimilitud(token, t2) >= 85)
    );
    
    const totalTokens = Math.max(tokens1.length, tokens2.length);
    const similitud = totalTokens > 0 ? Math.round((tokensComunes.length / totalTokens) * 100) : 0;
    
    return {
      similitud,
      tokensComunes,
      totalTokens
    };
  }

  /**
   * Busca usuarios duplicados en el sistema basado en similitud de nombres
   */
  static buscarUsuariosDuplicados(
    usuarios: { id: number; nombre: string; apellido: string; empleadoSapId?: number | null }[],
    umbralSimilitud: number = 85
  ): Array<{
    grupo: any[];
    similitud: number;
    razon: string;
  }> {
    const duplicados: Array<{ grupo: any[]; similitud: number; razon: string }> = [];
    const procesados = new Set<number>();

    for (let i = 0; i < usuarios.length; i++) {
      if (procesados.has(usuarios[i].id)) continue;

      const grupo = [usuarios[i]];
      procesados.add(usuarios[i].id);

      for (let j = i + 1; j < usuarios.length; j++) {
        if (procesados.has(usuarios[j].id)) continue;

        const nombre1 = `${usuarios[i].nombre} ${usuarios[i].apellido}`;
        const nombre2 = `${usuarios[j].nombre} ${usuarios[j].apellido}`;
        
        const similitud = this.calcularSimilitud(nombre1, nombre2);
        
        if (similitud >= umbralSimilitud) {
          grupo.push(usuarios[j]);
          procesados.add(usuarios[j].id);
        }
      }

      if (grupo.length > 1) {
        const similitudPromedio = grupo.length > 2 
          ? Math.round(grupo.reduce((sum, _, idx, arr) => {
              if (idx === arr.length - 1) return sum;
              const sim = this.calcularSimilitud(
                `${grupo[0].nombre} ${grupo[0].apellido}`,
                `${arr[idx + 1].nombre} ${arr[idx + 1].apellido}`
              );
              return sum + sim;
            }, 0) / (grupo.length - 1))
          : this.calcularSimilitud(
              `${grupo[0].nombre} ${grupo[0].apellido}`,
              `${grupo[1].nombre} ${grupo[1].apellido}`
            );

        duplicados.push({
          grupo,
          similitud: similitudPromedio,
          razon: `${grupo.length} usuarios con nombres similares (${similitudPromedio}% similitud)`
        });
      }
    }

    return duplicados.sort((a, b) => b.similitud - a.similitud);
  }

  /**
   * Sugiere qué usuario conservar cuando hay duplicados
   */
  static sugerirUsuarioAConservar(
    usuariosDuplicados: Array<{ id: number; username: string; empleadoSapId?: number | null; ultimoAcceso?: Date | null; createdAt: Date }>
  ): { usuarioConservado: any; razon: string; accionesParaOtros: string } {
    
    // Prioridad 1: Usuario con empleadoSapId (datos de SAP)
    const conSapId = usuariosDuplicados.filter(u => u.empleadoSapId);
    if (conSapId.length === 1) {
      return {
        usuarioConservado: conSapId[0],
        razon: 'Usuario con datos de SAP',
        accionesParaOtros: 'Transferir datos relevantes y desactivar/eliminar'
      };
    }

    // Prioridad 2: Usuario con acceso más reciente
    const conAccesoReciente = usuariosDuplicados
      .filter(u => u.ultimoAcceso)
      .sort((a, b) => new Date(b.ultimoAcceso!).getTime() - new Date(a.ultimoAcceso!).getTime());
    
    if (conAccesoReciente.length > 0) {
      return {
        usuarioConservado: conAccesoReciente[0],
        razon: `Usuario con último acceso el ${conAccesoReciente[0].ultimoAcceso}`,
        accionesParaOtros: 'Transferir datos relevantes y desactivar'
      };
    }

    // Prioridad 3: Usuario más antiguo (probablemente el original)
    const masAntiguo = usuariosDuplicados.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];

    return {
      usuarioConservado: masAntiguo,
      razon: `Usuario más antiguo (creado el ${masAntiguo.createdAt})`,
      accionesParaOtros: 'Transferir datos relevantes y desactivar'
    };
  }
} 

// ============================================================================
// 📊 UTILIDAD DE LOGGING PARA MATCHING Y DEBUGGING
// ============================================================================

export class MatchingLogger {
  private static logs: Array<{
    timestamp: Date;
    tipo: 'MATCH' | 'NO_MATCH' | 'ERROR' | 'WARNING' | 'INFO';
    origen: string;
    destino: string;
    similitud?: number;
    estrategia?: string;
    resultado: string;
    detalles?: any;
    sessionId?: string;
  }> = [];

  /**
   * Registra un intento de matching exitoso
   */
  static logMatch(
    origen: string,
    destino: string,
    similitud: number,
    estrategia: string,
    resultado: string,
    detalles?: any,
    sessionId?: string
  ): void {
    this.logs.push({
      timestamp: new Date(),
      tipo: 'MATCH',
      origen,
      destino,
      similitud,
      estrategia,
      resultado,
      detalles,
      sessionId
    });

    // Mantener solo los últimos 1000 logs para evitar memoria excesiva
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  /**
   * Registra un intento de matching fallido
   */
  static logNoMatch(
    origen: string,
    candidatos: number,
    umbral: number,
    razon: string,
    sessionId?: string
  ): void {
    this.logs.push({
      timestamp: new Date(),
      tipo: 'NO_MATCH',
      origen,
      destino: `${candidatos} candidatos evaluados`,
      resultado: razon,
      detalles: { candidatos, umbral },
      sessionId
    });
  }

  /**
   * Registra un error durante el matching
   */
  static logError(
    origen: string,
    error: string,
    detalles?: any,
    sessionId?: string
  ): void {
    this.logs.push({
      timestamp: new Date(),
      tipo: 'ERROR',
      origen,
      destino: 'ERROR',
      resultado: error,
      detalles,
      sessionId
    });
  }

  /**
   * Registra una advertencia durante el matching
   */
  static logWarning(
    origen: string,
    mensaje: string,
    detalles?: any,
    sessionId?: string
  ): void {
    this.logs.push({
      timestamp: new Date(),
      tipo: 'WARNING',
      origen,
      destino: 'WARNING',
      resultado: mensaje,
      detalles,
      sessionId
    });
  }

  /**
   * Registra información general
   */
  static logInfo(
    origen: string,
    mensaje: string,
    detalles?: any,
    sessionId?: string
  ): void {
    this.logs.push({
      timestamp: new Date(),
      tipo: 'INFO',
      origen,
      destino: 'INFO',
      resultado: mensaje,
      detalles,
      sessionId
    });
  }

  /**
   * Obtiene todos los logs de matching
   */
  static getLogs(filtros?: {
    tipo?: 'MATCH' | 'NO_MATCH' | 'ERROR' | 'WARNING' | 'INFO';
    desde?: Date;
    hasta?: Date;
    sessionId?: string;
    limite?: number;
  }): Array<any> {
    let logsF = [...this.logs];

    if (filtros) {
      if (filtros.tipo) {
        logsF = logsF.filter(log => log.tipo === filtros.tipo);
      }
      
      if (filtros.desde) {
        logsF = logsF.filter(log => log.timestamp >= filtros.desde!);
      }
      
      if (filtros.hasta) {
        logsF = logsF.filter(log => log.timestamp <= filtros.hasta!);
      }
      
      if (filtros.sessionId) {
        logsF = logsF.filter(log => log.sessionId === filtros.sessionId);
      }
      
      if (filtros.limite) {
        logsF = logsF.slice(-filtros.limite);
      }
    }

    return logsF.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Obtiene estadísticas de matching
   */
  static getEstadisticas(desde?: Date): {
    total: number;
    matchesExitosos: number;
    matchesFallidos: number;
    errores: number;
    advertencias: number;
    similitudPromedio: number;
    estrategiasMasUsadas: Array<{ estrategia: string; cantidad: number }>;
  } {
    let logsAnalizar = this.logs;
    
    if (desde) {
      logsAnalizar = this.logs.filter(log => log.timestamp >= desde);
    }

    const total = logsAnalizar.length;
    const matchesExitosos = logsAnalizar.filter(log => log.tipo === 'MATCH').length;
    const matchesFallidos = logsAnalizar.filter(log => log.tipo === 'NO_MATCH').length;
    const errores = logsAnalizar.filter(log => log.tipo === 'ERROR').length;
    const advertencias = logsAnalizar.filter(log => log.tipo === 'WARNING').length;

    // Calcular similitud promedio
    const matchesConSimilitud = logsAnalizar.filter(log => log.tipo === 'MATCH' && log.similitud);
    const similitudPromedio = matchesConSimilitud.length > 0
      ? Math.round(matchesConSimilitud.reduce((sum, log) => sum + (log.similitud || 0), 0) / matchesConSimilitud.length)
      : 0;

    // Estrategias más usadas
    const estrategias = new Map<string, number>();
    logsAnalizar
      .filter(log => log.estrategia)
      .forEach(log => {
        const estrategia = log.estrategia!;
        estrategias.set(estrategia, (estrategias.get(estrategia) || 0) + 1);
      });

    const estrategiasMasUsadas = Array.from(estrategias.entries())
      .map(([estrategia, cantidad]) => ({ estrategia, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return {
      total,
      matchesExitosos,
      matchesFallidos,
      errores,
      advertencias,
      similitudPromedio,
      estrategiasMasUsadas
    };
  }

  /**
   * Limpia todos los logs
   */
  static limpiarLogs(): void {
    this.logs = [];
  }

  /**
   * Exporta logs como JSON para análisis externo
   */
  static exportarLogs(filtros?: any): string {
    const logs = this.getLogs(filtros);
    return JSON.stringify(logs, null, 2);
  }
} 