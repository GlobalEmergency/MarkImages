"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSimpleDeaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - ultra simple
  const [formData, setFormData] = useState({
    name: "",
    street: "",
    number: "",
    city: "",
    country: "España",
    observations: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Construir la dirección completa en additional_info
      const fullAddress = `${formData.street}${formData.number ? ' ' + formData.number : ''}, ${formData.city}, ${formData.country}`;

      const payload = {
        name: formData.name,
        origin_observations: formData.observations || undefined,
        source_details: "Formulario simple - dirección sin geocodificar",

        // Location data mínimo
        location: {
          additional_info: fullAddress,
        },
      };

      const response = await fetch("/api/aeds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al crear el DEA");
      }

      alert("DEA creado exitosamente. Está pendiente de revisión y geocodificación.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error submitting form:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "10px", fontSize: "24px" }}>Agregar Nuevo DEA</h1>
      <p style={{ marginBottom: "30px", color: "#666", fontSize: "14px" }}>
        Formulario simplificado. Complete solo los datos básicos del DEA.
      </p>

      {error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#fee",
            color: "#c00",
            borderRadius: "5px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
            Nombre del DEA *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Ej: DEA Colegio San José"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        <fieldset
          style={{
            marginBottom: "20px",
            border: "1px solid #ddd",
            padding: "15px",
            borderRadius: "5px",
          }}
        >
          <legend style={{ fontWeight: "bold", fontSize: "16px", padding: "0 5px" }}>
            Dirección
          </legend>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Calle
            </label>
            <input
              type="text"
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder="Ej: Calle Mayor"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Número
            </label>
            <input
              type="text"
              name="number"
              value={formData.number}
              onChange={handleChange}
              placeholder="Ej: 23"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Población
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Ej: Madrid"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "0" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              País
            </label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="Ej: España"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>
        </fieldset>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
            Observaciones
          </label>
          <textarea
            name="observations"
            value={formData.observations}
            onChange={handleChange}
            rows={4}
            placeholder="Información adicional sobre el DEA..."
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div
          style={{
            padding: "12px",
            backgroundColor: "#f0f8ff",
            borderRadius: "4px",
            fontSize: "13px",
            marginBottom: "20px",
          }}
        >
          <strong>Nota:</strong> Los datos se completarán posteriormente por un administrador
          (coordenadas GPS, tipo de establecimiento, responsable, etc.)
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {loading ? "Guardando..." : "Guardar DEA"}
          </button>
        </div>
      </form>
    </div>
  );
}
