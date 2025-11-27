"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface District {
  id: string;
  district_code: number;
  name: string;
}

export default function SimpleNewDeaPage() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - solo campos mínimos
  const [formData, setFormData] = useState({
    // Datos básicos del DEA
    code: "",
    name: "",
    establishment_type: "",

    // Ubicación (sin coordenadas - se usarán coordenadas por defecto)
    location_street_type: "Calle",
    location_street_name: "",
    location_street_number: "",
    location_postal_code: "",
    location_district_id: "",

    // Responsable - solo lo mínimo
    responsible_name: "",
    responsible_email: "",
    responsible_ownership: "Público",
    responsible_local_ownership: "Pública",
    responsible_local_use: "Público",
  });

  // Fetch districts on mount
  useEffect(() => {
    fetch("/api/districts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDistricts(data.data);
        }
      })
      .catch((err) => console.error("Error fetching districts:", err));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Usar coordenadas por defecto del centro de Madrid
      // Estas podrán ser actualizadas posteriormente por un administrador
      const DEFAULT_LATITUDE = 40.4168;
      const DEFAULT_LONGITUDE = -3.7038;

      const payload = {
        code: formData.code,
        name: formData.name,
        establishment_type: formData.establishment_type,
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
        source_details: "Formulario simplificado - coordenadas por defecto",

        location: {
          street_type: formData.location_street_type,
          street_name: formData.location_street_name,
          street_number: formData.location_street_number || undefined,
          postal_code: formData.location_postal_code,
          district_id: parseInt(formData.location_district_id),
        },

        responsible: {
          name: formData.responsible_name,
          email: formData.responsible_email,
          ownership: formData.responsible_ownership,
          local_ownership: formData.responsible_local_ownership,
          local_use: formData.responsible_local_use,
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

      alert("DEA creado exitosamente. Está pendiente de revisión.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error submitting form:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "10px" }}>Agregar Nuevo DEA - Formulario Simple</h1>
      <p style={{ marginBottom: "30px", color: "#666", fontSize: "14px" }}>
        Complete solo los datos básicos. Los campos marcados con * son obligatorios.
        Las coordenadas GPS se establecerán por defecto y podrán ser actualizadas posteriormente.
      </p>

      {error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#fee",
            color: "#c00",
            borderRadius: "5px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* DATOS BÁSICOS DEL DEA */}
        <fieldset style={{ marginBottom: "25px", border: "1px solid #ddd", padding: "20px", borderRadius: "5px" }}>
          <legend style={{ fontWeight: "bold", fontSize: "16px" }}>Datos Básicos del DEA</legend>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Código *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              placeholder="Ej: 12-001"
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Nombre *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: DEA Colegio Nuestra Señora de Fátima"
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Tipo de Establecimiento *
            </label>
            <select
              name="establishment_type"
              value={formData.establishment_type}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              <option value="">Seleccione un tipo</option>
              <option value="Centro educativo">Centro educativo</option>
              <option value="Centro de salud">Centro de salud</option>
              <option value="Centro deportivo">Centro deportivo</option>
              <option value="Edificio público">Edificio público</option>
              <option value="Centro comercial">Centro comercial</option>
              <option value="Empresa privada">Empresa privada</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </fieldset>

        {/* UBICACIÓN */}
        <fieldset style={{ marginBottom: "25px", border: "1px solid #ddd", padding: "20px", borderRadius: "5px" }}>
          <legend style={{ fontWeight: "bold", fontSize: "16px" }}>Ubicación</legend>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Tipo de Vía *
              </label>
              <select
                name="location_street_type"
                value={formData.location_street_type}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                <option value="Calle">Calle</option>
                <option value="Avenida">Avenida</option>
                <option value="Plaza">Plaza</option>
                <option value="Paseo">Paseo</option>
                <option value="Camino">Camino</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Nombre de la Vía *
              </label>
              <input
                type="text"
                name="location_street_name"
                value={formData.location_street_name}
                onChange={handleChange}
                required
                placeholder="Ej: Manuel Muñoz"
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Número
              </label>
              <input
                type="text"
                name="location_street_number"
                value={formData.location_street_number}
                onChange={handleChange}
                placeholder="Ej: 30"
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Código Postal *
              </label>
              <input
                type="text"
                name="location_postal_code"
                value={formData.location_postal_code}
                onChange={handleChange}
                required
                placeholder="28026"
                pattern="[0-9]{5}"
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Distrito *
            </label>
            <select
              name="location_district_id"
              value={formData.location_district_id}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              <option value="">Seleccione un distrito</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.district_code} - {district.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: "10px", backgroundColor: "#f0f8ff", borderRadius: "4px", fontSize: "13px" }}>
            <strong>Nota:</strong> Las coordenadas GPS se establecerán automáticamente en el centro de Madrid
            y podrán ser actualizadas posteriormente por un administrador.
          </div>
        </fieldset>

        {/* RESPONSABLE */}
        <fieldset style={{ marginBottom: "25px", border: "1px solid #ddd", padding: "20px", borderRadius: "5px" }}>
          <legend style={{ fontWeight: "bold", fontSize: "16px" }}>Responsable</legend>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Nombre Completo *
            </label>
            <input
              type="text"
              name="responsible_name"
              value={formData.responsible_name}
              onChange={handleChange}
              required
              placeholder="Ej: Maria Del Carmen Escobar Cano"
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Email *
            </label>
            <input
              type="email"
              name="responsible_email"
              value={formData.responsible_email}
              onChange={handleChange}
              required
              placeholder="ejemplo@email.com"
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "0" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Titularidad DEA *
              </label>
              <select
                name="responsible_ownership"
                value={formData.responsible_ownership}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                <option value="Público">Público</option>
                <option value="Privado">Privado</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Titularidad Local *
              </label>
              <select
                name="responsible_local_ownership"
                value={formData.responsible_local_ownership}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                <option value="Pública">Pública</option>
                <option value="Privada">Privada</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Uso del Local *
              </label>
              <select
                name="responsible_local_use"
                value={formData.responsible_local_use}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                <option value="Público">Público</option>
                <option value="Privado">Privado</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* SUBMIT BUTTON */}
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
              fontSize: "16px",
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
              fontSize: "16px",
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
