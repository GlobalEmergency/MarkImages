import { DeaRepository, IDeaRepository } from '@/repositories/deaRepository';
import { DeaService, IDeaService } from '@/services/deaService';

/**
 * Service provider that implements dependency injection pattern
 * This centralizes the creation of services and their dependencies
 */
class ServiceProvider {
  private static deaRepository: IDeaRepository;
  private static deaService: IDeaService;

  /**
   * Get the DEA repository instance (singleton)
   */
  public static getDeaRepository(): IDeaRepository {
    if (!this.deaRepository) {
      this.deaRepository = new DeaRepository();
    }
    return this.deaRepository;
  }

  /**
   * Get the DEA service instance (singleton)
   */
  public static getDeaService(): IDeaService {
    if (!this.deaService) {
      const repository = this.getDeaRepository();
      this.deaService = new DeaService(repository);
    }
    return this.deaService;
  }
}

export default ServiceProvider;
