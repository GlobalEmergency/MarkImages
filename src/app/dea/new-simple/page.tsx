"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSimpleDeaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form state - ultra simple
  const [formData, setFormData] = useState({
    name: "",
    street: "",
    number: "",
    city: "",
    country: "España",
    observations: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Construir la dirección completa para additional_info
      const fullAddress = `${formData.street}${formData.number ? " " + formData.number : ""}, ${formData.city}, ${formData.country}`;

      const payload = {
        name: formData.name,
        origin_observations: formData.observations || undefined,
        source_details: "Formulario simple - dirección sin geocodificar",

        // Location data con campos estructurados
        location: {
          street_name: formData.street || undefined,
          street_number: formData.number || undefined,
          locality: formData.city || undefined,
          country: formData.country || undefined,
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

      // Mostrar modal de éxito
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error submitting form:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push("/");
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
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>País</label>
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

      {/* Modal de éxito */}
      {showSuccess && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "fadeIn 0.3s ease-in",
          }}
          onClick={handleSuccessClose}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "40px",
              maxWidth: "450px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              animation: "slideIn 0.3s ease-out",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icono de éxito */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "scaleIn 0.5s ease-out",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#1f2937",
                marginBottom: "12px",
              }}
            >
              ¡DEA Creado Exitosamente!
            </h2>

            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                marginBottom: "24px",
                lineHeight: "1.5",
              }}
            >
              El DEA ha sido registrado y está pendiente de revisión y geocodificación por un
              administrador.
            </p>

            <button
              onClick={handleSuccessClose}
              style={{
                padding: "12px 32px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#059669";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#10b981";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Volver al mapa
            </button>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }

            @keyframes slideIn {
              from {
                transform: translateY(-50px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }

            @keyframes scaleIn {
              0% {
                transform: scale(0);
              }
              50% {
                transform: scale(1.1);
              }
              100% {
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
