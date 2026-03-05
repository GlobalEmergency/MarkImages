import { Capacitor } from "@capacitor/core";

import { CapacitorTokenStorage } from "../storage/CapacitorTokenStorage";
import { HttpClient } from "../api/HttpClient";
import { ApiAuthRepository } from "../api/ApiAuthRepository";
import { ApiAedRepository } from "../api/ApiAedRepository";
import { CapacitorGeolocationService } from "../location/CapacitorGeolocation";
import { ReverseGeocodeService } from "../geocoding/ReverseGeocodeService";

import { LoginUseCase } from "../../application/use-cases/LoginUseCase";
import { RegisterUseCase } from "../../application/use-cases/RegisterUseCase";
import { CheckSessionUseCase } from "../../application/use-cases/CheckSessionUseCase";
import { GetAedsByBoundsUseCase } from "../../application/use-cases/GetAedsByBoundsUseCase";
import { GetAedDetailUseCase } from "../../application/use-cases/GetAedDetailUseCase";
import { CreateAedUseCase } from "../../application/use-cases/CreateAedUseCase";
import { GetNearbyAedsUseCase } from "../../application/use-cases/GetNearbyAedsUseCase";

// Monitoring — ports
import { ICrashReporter } from "../../domain/ports/ICrashReporter";
import { IPerformanceMonitor } from "../../domain/ports/IPerformanceMonitor";

// Monitoring — adapters (native Firebase on device, no-op on web/dev)
import { CapacitorCrashReporter } from "../firebase/CapacitorCrashReporter";
import { CapacitorPerformanceMonitor } from "../firebase/CapacitorPerformanceMonitor";
import { NoOpCrashReporter } from "../firebase/NoOpCrashReporter";
import { NoOpPerformanceMonitor } from "../firebase/NoOpPerformanceMonitor";

// Use nullish coalescing (??) so an explicitly-empty VITE_API_BASE_URL
// (set in .env.development) produces relative URLs routed through the Vite proxy.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Infrastructure
const tokenStorage = new CapacitorTokenStorage();
const httpClient = new HttpClient(API_BASE_URL, tokenStorage);
const authRepository = new ApiAuthRepository(httpClient, tokenStorage);
const aedRepository = new ApiAedRepository(httpClient);
const geolocationService = new CapacitorGeolocationService();
const reverseGeocodeService = new ReverseGeocodeService();

// Monitoring (native Firebase on device, no-op on web/dev)
const crashReporter: ICrashReporter = Capacitor.isNativePlatform()
  ? new CapacitorCrashReporter()
  : new NoOpCrashReporter();

const performanceMonitor: IPerformanceMonitor = Capacitor.isNativePlatform()
  ? new CapacitorPerformanceMonitor()
  : new NoOpPerformanceMonitor();

// Use Cases
const loginUseCase = new LoginUseCase(authRepository);
const registerUseCase = new RegisterUseCase(authRepository);
const checkSessionUseCase = new CheckSessionUseCase(tokenStorage, authRepository);
const getAedsByBoundsUseCase = new GetAedsByBoundsUseCase(aedRepository);
const getAedDetailUseCase = new GetAedDetailUseCase(aedRepository);
const createAedUseCase = new CreateAedUseCase(aedRepository);
const getNearbyAedsUseCase = new GetNearbyAedsUseCase(aedRepository);

export {
  // Infrastructure (authRepository exported for logout in AuthContext)
  httpClient,
  authRepository,
  tokenStorage,
  geolocationService,
  reverseGeocodeService,
  crashReporter,
  performanceMonitor,
  // Use Cases
  loginUseCase,
  registerUseCase,
  checkSessionUseCase,
  getAedsByBoundsUseCase,
  getAedDetailUseCase,
  createAedUseCase,
  getNearbyAedsUseCase,
};
