import { Injectable, Logger } from '@nestjs/common';
import { SapHanaService } from '../sap/sap-hana.service';

export interface Chopera {
  itemCode: string;
  itemName: string;
  status: string;
  ciudad: string;
  serieActivo: string;
  cardCode: string;
  cardName: string;
  aliasName: string;
}

@Injectable()
export class ChoperasService {
  private readonly logger = new Logger(ChoperasService.name);

  constructor(private readonly sapHanaService: SapHanaService) {}

  /**
   * Obtiene todas las choperas directamente desde SAP
   */
  async obtenerTodas(): Promise<Chopera[]> {
    this.logger.log('🍺 Obteniendo choperas directamente desde SAP...');
    
    try {
      const choperas = await this.sapHanaService.obtenerChoperas();
      this.logger.log(`✅ Obtenidas ${choperas.length} choperas desde SAP`);
      
      return choperas.map(chopera => ({
        itemCode: chopera.ItemCode,
        itemName: chopera.ItemName,
        status: chopera.Status,
        ciudad: chopera.Ciudad,
        serieActivo: chopera.SerieActivo,
        cardCode: chopera.CardCode,
        cardName: chopera.CardName,
        aliasName: chopera.AliasName,
      }));
    } catch (error) {
      this.logger.error('Error obteniendo choperas:', error);
      throw error;
    }
  }

  /**
   * Obtiene una chopera por su código de SAP
   */
  async obtenerPorItemCode(itemCode: string): Promise<Chopera | null> {
    try {
      const choperas = await this.obtenerTodas();
      return choperas.find(c => c.itemCode === itemCode) || null;
    } catch (error) {
      this.logger.error('Error obteniendo chopera por itemCode:', error);
      throw error;
    }
  }

  /**
   * Busca choperas por término de búsqueda
   */
  async buscar(termino: string): Promise<Chopera[]> {
    try {
      const choperas = await this.obtenerTodas();
      const terminoLower = termino.toLowerCase();
      
      return choperas.filter(c => 
        c.itemCode.toLowerCase().includes(terminoLower) ||
        c.itemName.toLowerCase().includes(terminoLower) ||
        c.ciudad.toLowerCase().includes(terminoLower) ||
        c.serieActivo.toLowerCase().includes(terminoLower) ||
        c.cardCode.toLowerCase().includes(terminoLower) ||
        c.cardName.toLowerCase().includes(terminoLower) ||
        c.aliasName.toLowerCase().includes(terminoLower)
      );
    } catch (error) {
      this.logger.error('Error buscando choperas:', error);
      throw error;
    }
  }

  /**
   * Filtra choperas por ubicación (ciudad)
   */
  async filtrarPorUbicacion(ubicacion: string): Promise<Chopera[]> {
    try {
      const choperas = await this.obtenerTodas();
      return choperas.filter(c => 
        c.ciudad.toLowerCase().includes(ubicacion.toLowerCase())
      );
    } catch (error) {
      this.logger.error('Error filtrando choperas por ubicación:', error);
      throw error;
    }
  }

  /**
   * Filtra choperas por estado (status)
   */
  async filtrarPorEstado(estado: string): Promise<Chopera[]> {
    try {
      const choperas = await this.obtenerTodas();
      return choperas.filter(c => 
        c.status.toLowerCase().includes(estado.toLowerCase())
      );
    } catch (error) {
      this.logger.error('Error filtrando choperas por estado:', error);
      throw error;
    }
  }

  /**
   * Filtra choperas por fabricante (cardName)
   */
  async filtrarPorFabricante(fabricante: string): Promise<Chopera[]> {
    try {
      const choperas = await this.obtenerTodas();
      return choperas.filter(c => 
        c.cardName.toLowerCase().includes(fabricante.toLowerCase())
      );
    } catch (error) {
      this.logger.error('Error filtrando choperas por fabricante:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de choperas
   */
  async obtenerEstadisticas(): Promise<any> {
    try {
      const choperas = await this.obtenerTodas();
      
      const estadisticas = {
        total: choperas.length,
        porEstado: {},
        porFabricante: {},
        porUbicacion: {},
      };

      // Contar por estado
      choperas.forEach(c => {
        estadisticas.porEstado[c.status] = (estadisticas.porEstado[c.status] || 0) + 1;
      });

      // Contar por fabricante (cardName)
      choperas.forEach(c => {
        estadisticas.porFabricante[c.cardName] = (estadisticas.porFabricante[c.cardName] || 0) + 1;
      });

      // Contar por ubicación (ciudad)
      choperas.forEach(c => {
        estadisticas.porUbicacion[c.ciudad] = (estadisticas.porUbicacion[c.ciudad] || 0) + 1;
      });

      return estadisticas;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}
