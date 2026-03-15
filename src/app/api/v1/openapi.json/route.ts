/**
 * GET /api/v1/openapi.json
 *
 * Returns the OpenAPI 3.1 specification for the DeaMap Public API v1.
 */

import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "DeaMap Public API",
    version: "1.0.0",
    description:
      "Public API to query AED (Automated External Defibrillator) locations in Spain. " +
      "Use this API to find nearby defibrillators, search by city, or retrieve details for a specific AED. " +
      "Rate limited to 60 requests per minute per IP address.",
    contact: {
      name: "DeaMap",
      url: "https://deamap.es",
    },
    license: {
      name: "CC BY-NC 4.0",
      url: "https://creativecommons.org/licenses/by-nc/4.0/",
    },
  },
  servers: [
    {
      url: "https://deamap.es/api/v1",
      description: "Production",
    },
  ],
  paths: {
    "/aeds/nearby": {
      get: {
        operationId: "findNearbyAeds",
        summary: "Find AEDs near a location",
        description:
          "Returns the closest AEDs to a given latitude/longitude using PostGIS spatial queries. " +
          "Results are sorted by distance. Ideal for emergency scenarios.",
        parameters: [
          {
            name: "lat",
            in: "query",
            required: true,
            description: "Latitude of the search point (-90 to 90)",
            schema: { type: "number", minimum: -90, maximum: 90 },
            example: 40.4168,
          },
          {
            name: "lng",
            in: "query",
            required: true,
            description: "Longitude of the search point (-180 to 180)",
            schema: { type: "number", minimum: -180, maximum: 180 },
            example: -3.7038,
          },
          {
            name: "radius",
            in: "query",
            required: false,
            description: "Search radius in kilometers (default: 5, max: 50)",
            schema: { type: "number", default: 5, minimum: 0.1, maximum: 50 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Maximum number of results (default: 10, max: 50)",
            schema: { type: "integer", default: 10, minimum: 1, maximum: 50 },
          },
        ],
        responses: {
          "200": {
            description: "List of nearby AEDs sorted by distance",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NearbyAedsResponse" },
              },
            },
          },
          "400": {
            description: "Invalid parameters",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/aeds/{id}": {
      get: {
        operationId: "getAedById",
        summary: "Get AED details by ID",
        description:
          "Returns detailed information about a specific AED including address, schedule, and images.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "AED unique identifier (UUID)",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "AED details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AedDetailResponse" },
              },
            },
          },
          "404": { description: "AED not found" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/aeds/city/{city}": {
      get: {
        operationId: "getAedsByCity",
        summary: "Get AEDs in a city",
        description:
          "Returns all AEDs in a given city. City names are case-insensitive. " +
          "Supports pagination with limit and offset parameters.",
        parameters: [
          {
            name: "city",
            in: "path",
            required: true,
            description: "City name (case-insensitive, use hyphens for spaces)",
            schema: { type: "string" },
            example: "Madrid",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Maximum number of results (default: 100, max: 500)",
            schema: { type: "integer", default: 100, minimum: 1, maximum: 500 },
          },
          {
            name: "offset",
            in: "query",
            required: false,
            description: "Pagination offset (default: 0)",
            schema: { type: "integer", default: 0, minimum: 0 },
          },
        ],
        responses: {
          "200": {
            description: "List of AEDs in the city",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CityAedsResponse" },
              },
            },
          },
          "404": { description: "No AEDs found in this city" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/aeds/stats": {
      get: {
        operationId: "getAedStats",
        summary: "Get AED statistics",
        description:
          "Returns general statistics: total AEDs, number of cities, and top 50 cities by AED count.",
        responses: {
          "200": {
            description: "AED statistics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatsResponse" },
              },
            },
          },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
  },
  components: {
    schemas: {
      AedAddress: {
        type: "object",
        properties: {
          street: { type: "string", nullable: true, description: "Full street address" },
          city: { type: "string", nullable: true },
          district: { type: "string", nullable: true },
          postal_code: { type: "string", nullable: true },
          access_instructions: {
            type: "string",
            nullable: true,
            description: "How to access the AED",
          },
        },
      },
      AedSchedule: {
        type: "object",
        properties: {
          is_24h: { type: "boolean", description: "Whether the AED is available 24 hours" },
          weekday_opening: { type: "string", nullable: true, example: "08:00" },
          weekday_closing: { type: "string", nullable: true, example: "20:00" },
          saturday_opening: { type: "string", nullable: true },
          saturday_closing: { type: "string", nullable: true },
          sunday_opening: { type: "string", nullable: true },
          sunday_closing: { type: "string", nullable: true },
        },
      },
      NearbyAed: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          distance_km: { type: "number", description: "Distance from search point in km" },
          address: { $ref: "#/components/schemas/AedAddress" },
          schedule: { $ref: "#/components/schemas/AedSchedule" },
          web_url: {
            type: "string",
            format: "uri",
            description: "Link to AED detail page on DeaMap",
          },
        },
      },
      NearbyAedsResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/NearbyAed" } },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer" },
              query: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                  radius_km: { type: "number" },
                  limit: { type: "integer" },
                },
              },
              api_version: { type: "string" },
            },
          },
        },
      },
      AedDetail: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          establishment_type: { type: "string", nullable: true },
          latitude: { type: "number" },
          longitude: { type: "number" },
          address: { $ref: "#/components/schemas/AedAddress" },
          schedule: { $ref: "#/components/schemas/AedSchedule" },
          images: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"],
                },
                url: { type: "string", format: "uri" },
              },
            },
          },
          web_url: { type: "string", format: "uri" },
        },
      },
      AedDetailResponse: {
        type: "object",
        properties: {
          data: { $ref: "#/components/schemas/AedDetail" },
          meta: {
            type: "object",
            properties: {
              api_version: { type: "string" },
            },
          },
        },
      },
      CityAedsResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/NearbyAed" } },
          meta: {
            type: "object",
            properties: {
              city: { type: "string" },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              has_more: { type: "boolean" },
              api_version: { type: "string" },
            },
          },
        },
      },
      StatsResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              total_aeds: { type: "integer" },
              total_cities: { type: "integer" },
              top_cities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
          meta: {
            type: "object",
            properties: {
              api_version: { type: "string" },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          docs: { type: "string", format: "uri" },
        },
      },
    },
  },
};

export async function GET() {
  const response = NextResponse.json(spec);
  response.headers.set("Cache-Control", "public, s-maxage=86400");
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}
