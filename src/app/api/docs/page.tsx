import { Code, Globe, MapPin, Shield, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Documentation - DeaMap Public API v1",
  description:
    "Free public REST API to query AED (defibrillator) locations in Spain. Find nearby defibrillators, search by city, and access statistics. OpenAPI specification available.",
  alternates: {
    canonical: "/api/docs",
  },
  openGraph: {
    title: "DeaMap Public API Documentation",
    description: "Free API to query 30,000+ defibrillator locations across Spain.",
    url: "/api/docs",
  },
};

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/aeds/nearby",
    description: "Find the nearest AEDs to a geographic coordinate",
    params: "lat, lng (required), radius, limit (optional)",
    example: "/api/v1/aeds/nearby?lat=40.4168&lng=-3.7038&radius=2&limit=5",
  },
  {
    method: "GET",
    path: "/api/v1/aeds/{id}",
    description: "Get detailed information about a specific AED",
    params: "id (UUID, required)",
    example: "/api/v1/aeds/550e8400-e29b-41d4-a716-446655440000",
  },
  {
    method: "GET",
    path: "/api/v1/aeds/city/{city}",
    description: "Get all AEDs in a city with pagination",
    params: "city (required), limit, offset (optional)",
    example: "/api/v1/aeds/city/Madrid?limit=50",
  },
  {
    method: "GET",
    path: "/api/v1/aeds/stats",
    description: "Get global statistics: total AEDs, cities, and top cities",
    params: "None",
    example: "/api/v1/aeds/stats",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              DeaMap
            </Link>
            <span>/</span>
            <span className="text-white">API Docs</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">DeaMap Public API</h1>
          <p className="text-xl text-gray-300 mb-6 max-w-2xl">
            Free REST API to query AED (defibrillator) locations across Spain. No authentication
            required.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="bg-green-600/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
              v1.0
            </span>
            <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
              REST / JSON
            </span>
            <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
              No Auth Required
            </span>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-8">
        {/* Quick Start */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Quick Start
          </h2>
          <p className="text-gray-600 mb-4">
            Find the 5 nearest defibrillators to Madrid city center:
          </p>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
            <code>
              curl
              &quot;https://deamap.es/api/v1/aeds/nearby?lat=40.4168&amp;lng=-3.7038&amp;limit=5&quot;
            </code>
          </pre>
        </section>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Globe className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">CORS Enabled</h3>
            <p className="text-sm text-gray-600">
              Access from any origin. Use directly from browser-based applications.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Shield className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Rate Limited</h3>
            <p className="text-sm text-gray-600">
              60 requests per minute per IP. Responses include cache headers.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Code className="w-8 h-8 text-purple-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">OpenAPI Spec</h3>
            <p className="text-sm text-gray-600">
              Full{" "}
              <a href="/api/v1/openapi.json" className="text-blue-600 hover:underline">
                OpenAPI 3.1 specification
              </a>{" "}
              for code generation and tooling.
            </p>
          </div>
        </section>

        {/* Base URL */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Base URL</h2>
          <pre className="bg-gray-100 text-gray-800 p-3 rounded-lg text-sm font-mono">
            https://deamap.es/api/v1
          </pre>
        </section>

        {/* Endpoints */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-red-500" />
            Endpoints
          </h2>
          <div className="space-y-6">
            {endpoints.map((ep) => (
              <div key={ep.path} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                    {ep.method}
                  </span>
                  <code className="text-sm font-mono text-gray-900">{ep.path}</code>
                </div>
                <p className="text-gray-600 text-sm mb-2">{ep.description}</p>
                <p className="text-gray-500 text-xs mb-2">
                  <strong>Parameters:</strong> {ep.params}
                </p>
                <pre className="bg-gray-50 text-gray-700 p-2 rounded text-xs overflow-x-auto">
                  <code>GET https://deamap.es{ep.example}</code>
                </pre>
              </div>
            ))}
          </div>
        </section>

        {/* Response Format */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Response Format</h2>
          <p className="text-gray-600 mb-4">All responses follow a consistent structure:</p>
          <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`{
  "data": [ ... ],     // Array or object with results
  "meta": {
    "total": 10,       // Result count
    "api_version": "v1"
  }
}`}</code>
          </pre>
          <p className="text-gray-600 mt-4 text-sm">
            Error responses include <code className="bg-gray-100 px-1 rounded">error</code> and{" "}
            <code className="bg-gray-100 px-1 rounded">message</code> fields.
          </p>
        </section>

        {/* Rate Limiting */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limiting</h2>
          <p className="text-gray-600 mb-3">
            The API is limited to <strong>60 requests per minute</strong> per IP address. Exceeding
            this limit returns a <code className="bg-gray-100 px-1 rounded">429</code> status with a{" "}
            <code className="bg-gray-100 px-1 rounded">Retry-After</code> header.
          </p>
          <p className="text-gray-600 text-sm">
            Responses include <code className="bg-gray-100 px-1 rounded">Cache-Control</code>{" "}
            headers. Please cache responses when possible to reduce API calls.
          </p>
        </section>

        {/* LLM Integration */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">LLM / AI Integration</h2>
          <p className="text-gray-600 mb-3">
            This API is designed to be easily consumed by AI assistants and large language models:
          </p>
          <ul className="text-gray-600 text-sm space-y-2">
            <li>
              <code className="bg-gray-100 px-1 rounded">/llms.txt</code> -{" "}
              <a href="/llms.txt" className="text-blue-600 hover:underline">
                Summary for LLMs
              </a>
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">/llms-full.txt</code> -{" "}
              <a href="/llms-full.txt" className="text-blue-600 hover:underline">
                Full context with examples
              </a>
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">/.well-known/ai-plugin.json</code> -{" "}
              <a href="/.well-known/ai-plugin.json" className="text-blue-600 hover:underline">
                AI plugin manifest
              </a>
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">/api/v1/openapi.json</code> -{" "}
              <a href="/api/v1/openapi.json" className="text-blue-600 hover:underline">
                OpenAPI specification
              </a>
            </li>
          </ul>
        </section>

        {/* Footer link */}
        <div className="text-center pt-4">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            Back to DeaMap
          </Link>
        </div>
      </div>
    </div>
  );
}
