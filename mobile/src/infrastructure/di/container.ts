import { CapacitorTokenStorage } from "../storage/CapacitorTokenStorage";
import { HttpClient } from "../api/HttpClient";
import { ApiAuthRepository } from "../api/ApiAuthRepository";
import { ApiAedRepository } from "../api/ApiAedRepository";
import { CapacitorGeolocationService } from "../location/CapacitorGeolocation";

import { LoginUseCase } from "../../application/use-cases/LoginUseCase";
import { RegisterUseCase } from "../../application/use-cases/RegisterUseCase";
import { GetAedsByBoundsUseCase } from "../../application/use-cases/GetAedsByBoundsUseCase";
import { GetAedDetailUseCase } from "../../application/use-cases/GetAedDetailUseCase";
import { CreateAedUseCase } from "../../application/use-cases/CreateAedUseCase";
import { GetNearbyAedsUseCase } from "../../application/use-cases/GetNearbyAedsUseCase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Infrastructure
const tokenStorage = new CapacitorTokenStorage();
const httpClient = new HttpClient(API_BASE_URL, tokenStorage);
const authRepository = new ApiAuthRepository(httpClient, tokenStorage);
const aedRepository = new ApiAedRepository(httpClient);
const geolocationService = new CapacitorGeolocationService();

// Use Cases
const loginUseCase = new LoginUseCase(authRepository);
const registerUseCase = new RegisterUseCase(authRepository);
const getAedsByBoundsUseCase = new GetAedsByBoundsUseCase(aedRepository);
const getAedDetailUseCase = new GetAedDetailUseCase(aedRepository);
const createAedUseCase = new CreateAedUseCase(aedRepository);
const getNearbyAedsUseCase = new GetNearbyAedsUseCase(aedRepository);

export {
  // Infrastructure (exposed for AuthContext which needs direct repo access)
  httpClient,
  authRepository,
  tokenStorage,
  geolocationService,
  // Use Cases
  loginUseCase,
  registerUseCase,
  getAedsByBoundsUseCase,
  getAedDetailUseCase,
  createAedUseCase,
  getNearbyAedsUseCase,
};
