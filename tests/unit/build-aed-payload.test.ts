import { describe, it, expect } from "vitest";

import {
  buildAedPayload,
  buildObservations,
  type SimpleDeaFormData,
  type ImagePayload,
} from "@/lib/build-aed-payload";

// ── Helpers ───────────────────────────────────────────────────────

/** Factory that returns a form with sensible defaults; override as needed */
function makeForm(overrides: Partial<SimpleDeaFormData> = {}): SimpleDeaFormData {
  return {
    latitude: "",
    longitude: "",
    street: "",
    number: "",
    city: "",
    postalCode: "",
    name: "",
    establishmentType: "",
    observations: "",
    accessDescription: "",
    floor: "",
    specificLocation: "",
    scheduleDescription: "",
    ...overrides,
  };
}

function makeImage(overrides: Partial<ImagePayload> = {}): ImagePayload {
  return {
    original_url: "https://s3.example.com/dea-community/photo.jpg",
    type: "FRONT",
    order: 1,
    ...overrides,
  };
}

// ── buildObservations ─────────────────────────────────────────────

describe("buildObservations", () => {
  it("debe devolver cadena vacía cuando no hay observaciones ni detalles extra", () => {
    const result = buildObservations(makeForm());
    expect(result).toBe("");
  });

  it("debe incluir solo las observaciones generales cuando no hay detalles extra", () => {
    const result = buildObservations(makeForm({ observations: "Visible desde la calle" }));
    expect(result).toBe("Visible desde la calle");
  });

  it("debe combinar observaciones y detalles extra separados por salto de línea", () => {
    const result = buildObservations(
      makeForm({
        observations: "Visible desde la calle",
        accessDescription: "Por la puerta principal",
        floor: "Planta baja",
      })
    );

    expect(result).toBe(
      "Visible desde la calle\nAcceso: Por la puerta principal\nPlanta: Planta baja"
    );
  });

  it("debe incluir todos los campos extra con sus etiquetas", () => {
    const result = buildObservations(
      makeForm({
        accessDescription: "Recepción",
        floor: "2ª planta",
        specificLocation: "Junto al ascensor",
        scheduleDescription: "L-V 9-21h",
      })
    );

    expect(result).toContain("Acceso: Recepción");
    expect(result).toContain("Planta: 2ª planta");
    expect(result).toContain("Ubicación específica: Junto al ascensor");
    expect(result).toContain("Horario: L-V 9-21h");
  });

  it("debe omitir campos extra vacíos sin dejar líneas en blanco", () => {
    const result = buildObservations(
      makeForm({
        observations: "Nota",
        floor: "Bajo",
        // accessDescription vacío → no debe aparecer
      })
    );

    expect(result).toBe("Nota\nPlanta: Bajo");
    expect(result).not.toContain("Acceso:");
  });
});

// ── buildAedPayload ───────────────────────────────────────────────

describe("buildAedPayload", () => {
  describe("campos requeridos", () => {
    it("debe incluir el nombre en el payload", () => {
      const payload = buildAedPayload(makeForm({ name: "DEA Farmacia Central" }));
      expect(payload.name).toBe("DEA Farmacia Central");
    });

    it("debe siempre incluir source_details", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));
      expect(payload.source_details).toBeDefined();
      expect(typeof payload.source_details).toBe("string");
    });
  });

  describe("coordenadas", () => {
    it("debe incluir lat/lng parseados cuando ambos están presentes", () => {
      const payload = buildAedPayload(
        makeForm({ name: "Test", latitude: "40.416775", longitude: "-3.703790" })
      );

      expect(payload.latitude).toBeCloseTo(40.416775, 5);
      expect(payload.longitude).toBeCloseTo(-3.70379, 5);
    });

    it("debe omitir lat/lng cuando están vacíos", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));

      expect(payload.latitude).toBeUndefined();
      expect(payload.longitude).toBeUndefined();
    });

    it("debe omitir lat/lng cuando solo uno está presente", () => {
      const payload = buildAedPayload(makeForm({ name: "Test", latitude: "40.0" }));

      expect(payload.latitude).toBeUndefined();
      expect(payload.longitude).toBeUndefined();
    });

    it("debe indicar geolocalización en source_details cuando hay coordenadas", () => {
      const payload = buildAedPayload(
        makeForm({ name: "Test", latitude: "40.0", longitude: "-3.0" })
      );
      expect(payload.source_details).toContain("geolocalización");
    });

    it("debe indicar sin geocodificar en source_details cuando no hay coordenadas", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));
      expect(payload.source_details).toContain("sin geocodificar");
    });
  });

  describe("ubicación", () => {
    it("debe mapear campos de dirección al objeto location", () => {
      const payload = buildAedPayload(
        makeForm({
          name: "Test",
          street: "Calle Mayor",
          number: "15",
          postalCode: "28001",
        })
      );

      expect(payload.location.street_name).toBe("Calle Mayor");
      expect(payload.location.street_number).toBe("15");
      expect(payload.location.postal_code).toBe("28001");
    });

    it("debe mapear city al campo city_name del location", () => {
      const payload = buildAedPayload(makeForm({ name: "Test", city: "Madrid" }));
      expect(payload.location.city_name).toBe("Madrid");
    });

    it("debe omitir campos de location vacíos (undefined, no cadena vacía)", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));

      expect(payload.location.street_name).toBeUndefined();
      expect(payload.location.street_number).toBeUndefined();
      expect(payload.location.postal_code).toBeUndefined();
      expect(payload.location.city_name).toBeUndefined();
      expect(payload.location.floor).toBeUndefined();
    });

    it("debe mapear detalles extra al objeto location", () => {
      const payload = buildAedPayload(
        makeForm({
          name: "Test",
          accessDescription: "Por recepción",
          floor: "2",
          specificLocation: "Hall",
        })
      );

      expect(payload.location.access_instructions).toBe("Por recepción");
      expect(payload.location.floor).toBe("2");
      expect(payload.location.location_details).toBe("Hall");
    });
  });

  describe("tipo de establecimiento", () => {
    it("debe incluir establishment_type cuando se proporciona", () => {
      const payload = buildAedPayload(makeForm({ name: "Test", establishmentType: "Farmacia" }));
      expect(payload.establishment_type).toBe("Farmacia");
    });

    it("debe omitir establishment_type cuando está vacío", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));
      expect(payload.establishment_type).toBeUndefined();
    });
  });

  describe("observaciones", () => {
    it("debe incluir origin_observations cuando hay texto", () => {
      const payload = buildAedPayload(makeForm({ name: "Test", observations: "Bien visible" }));
      expect(payload.origin_observations).toBe("Bien visible");
    });

    it("debe omitir origin_observations cuando no hay texto ni detalles extra", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));
      expect(payload.origin_observations).toBeUndefined();
    });

    it("debe combinar observaciones con detalles extra en origin_observations", () => {
      const payload = buildAedPayload(
        makeForm({
          name: "Test",
          observations: "Nota",
          floor: "3",
        })
      );
      expect(payload.origin_observations).toContain("Nota");
      expect(payload.origin_observations).toContain("Planta: 3");
    });
  });

  describe("imágenes", () => {
    it("debe incluir images cuando se proporcionan", () => {
      const images = [makeImage(), makeImage({ type: "CONTEXT", order: 2 })];
      const payload = buildAedPayload(makeForm({ name: "Test" }), images);

      expect(payload.images).toHaveLength(2);
      expect(payload.images![0].type).toBe("FRONT");
      expect(payload.images![1].type).toBe("CONTEXT");
    });

    it("debe omitir images cuando el array está vacío", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }), []);
      expect(payload.images).toBeUndefined();
    });

    it("debe omitir images cuando no se proporciona argumento", () => {
      const payload = buildAedPayload(makeForm({ name: "Test" }));
      expect(payload.images).toBeUndefined();
    });
  });

  describe("caso completo", () => {
    it("debe construir un payload completo con todos los campos", () => {
      const form = makeForm({
        latitude: "40.416775",
        longitude: "-3.703790",
        street: "Gran Vía",
        number: "1",
        city: "Madrid",
        postalCode: "28013",
        name: "DEA Centro Comercial",
        establishmentType: "Centro comercial",
        observations: "En la entrada principal",
        accessDescription: "Al lado de la información",
        floor: "Planta baja",
        specificLocation: "Junto al punto de información",
        scheduleDescription: "L-D 10-22h",
      });

      const images = [
        makeImage({ original_url: "https://s3.example.com/front.jpg", type: "FRONT", order: 1 }),
        makeImage({ original_url: "https://s3.example.com/ctx.jpg", type: "CONTEXT", order: 2 }),
      ];

      const payload = buildAedPayload(form, images);

      // Verify all fields present
      expect(payload.name).toBe("DEA Centro Comercial");
      expect(payload.establishment_type).toBe("Centro comercial");
      expect(payload.latitude).toBeCloseTo(40.416775, 5);
      expect(payload.longitude).toBeCloseTo(-3.70379, 5);
      expect(payload.source_details).toContain("geolocalización");
      expect(payload.origin_observations).toContain("En la entrada principal");
      expect(payload.origin_observations).toContain("Horario: L-D 10-22h");
      expect(payload.location.street_name).toBe("Gran Vía");
      expect(payload.location.street_number).toBe("1");
      expect(payload.location.postal_code).toBe("28013");
      expect(payload.location.city_name).toBe("Madrid");
      expect(payload.location.access_instructions).toBe("Al lado de la información");
      expect(payload.location.floor).toBe("Planta baja");
      expect(payload.location.location_details).toBe("Junto al punto de información");
      expect(payload.images).toHaveLength(2);
    });
  });
});
