"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// Dynamic import to avoid SSR issues with Leaflet
const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "400px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        borderRadius: "8px",
      }}
    >
      <p style={{ color: "#666" }}>Cargando mapa...</p>
    </div>
  ),
});

interface District {
  id: string;
  district_code: number;
  name: string;
}

export default function NewDeaPage() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Basic AED data
    code: "",
    name: "",
    establishment_type: "",
    latitude: "",
    longitude: "",
    provisional_number: "",
    source_details: "",
    origin_observations: "",

    // Location data
    location_street_type: "Calle",
    location_street_name: "",
    location_street_number: "",
    location_additional_info: "",
    location_postal_code: "",
    location_district_id: "",
    location_access_description: "",
    location_visible_references: "",
    location_floor: "",
    location_specific_location: "",
    location_observations: "",
    location_access_warnings: "",

    // Responsible data
    responsible_name: "",
    responsible_email: "",
    responsible_phone: "",
    responsible_alternative_phone: "",
    responsible_ownership: "Público",
    responsible_local_ownership: "Pública",
    responsible_local_use: "Público",
    responsible_organization: "",
    responsible_position: "",
    responsible_department: "",
    responsible_observations: "",

    // Schedule data (optional)
    include_schedule: false,
    schedule_description: "",
    schedule_has_24h: false,
    schedule_has_restricted: false,
    schedule_weekday_opening: "",
    schedule_weekday_closing: "",
    schedule_saturday_opening: "",
    schedule_saturday_closing: "",
    schedule_sunday_opening: "",
    schedule_sunday_closing: "",
    schedule_holidays_as_weekday: false,
    schedule_closed_holidays: false,
    schedule_closed_august: false,
    schedule_observations: "",
    schedule_exceptions: "",
    schedule_access_instructions: "",
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
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build API request payload
      const payload = {
        code: formData.code,
        name: formData.name,
        establishment_type: formData.establishment_type,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        provisional_number: formData.provisional_number
          ? parseInt(formData.provisional_number)
          : undefined,
        source_details: formData.source_details || undefined,
        origin_observations: formData.origin_observations || undefined,

        location: {
          street_type: formData.location_street_type,
          street_name: formData.location_street_name,
          street_number: formData.location_street_number || undefined,
          additional_info: formData.location_additional_info || undefined,
          postal_code: formData.location_postal_code,
          district_id: parseInt(formData.location_district_id),
          access_description: formData.location_access_description || undefined,
          visible_references: formData.location_visible_references || undefined,
          floor: formData.location_floor || undefined,
          specific_location: formData.location_specific_location || undefined,
          location_observations: formData.location_observations || undefined,
          access_warnings: formData.location_access_warnings || undefined,
        },

        responsible: {
          name: formData.responsible_name,
          email: formData.responsible_email,
          phone: formData.responsible_phone || undefined,
          alternative_phone: formData.responsible_alternative_phone || undefined,
          ownership: formData.responsible_ownership,
          local_ownership: formData.responsible_local_ownership,
          local_use: formData.responsible_local_use,
          organization: formData.responsible_organization || undefined,
          position: formData.responsible_position || undefined,
          department: formData.responsible_department || undefined,
          observations: formData.responsible_observations || undefined,
        },

        schedule: formData.include_schedule
          ? {
              description: formData.schedule_description || undefined,
              has_24h_surveillance: formData.schedule_has_24h,
              has_restricted_access: formData.schedule_has_restricted,
              weekday_opening: formData.schedule_weekday_opening || undefined,
              weekday_closing: formData.schedule_weekday_closing || undefined,
              saturday_opening: formData.schedule_saturday_opening || undefined,
              saturday_closing: formData.schedule_saturday_closing || undefined,
              sunday_opening: formData.schedule_sunday_opening || undefined,
              sunday_closing: formData.schedule_sunday_closing || undefined,
              holidays_as_weekday: formData.schedule_holidays_as_weekday,
              closed_on_holidays: formData.schedule_closed_holidays,
              closed_in_august: formData.schedule_closed_august,
              observations: formData.schedule_observations || undefined,
              schedule_exceptions: formData.schedule_exceptions || undefined,
              access_instructions: formData.schedule_access_instructions || undefined,
            }
          : undefined,
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

      // Redirect to home on success
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
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Agregar Nuevo DEA</h1>
      <p style={{ marginBottom: "30px", color: "#666" }}>
        Complete el formulario para agregar un nuevo DEA. Los campos marcados con * son
        obligatorios. El DEA estará en estado &quot;Pendiente de Revisión&quot; hasta que sea
        validado por un administrador.
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
        {/* BASIC AED DATA */}
        <fieldset
          style={{
            marginBottom: "30px",
            border: "1px solid #ddd",
            padding: "20px",
            borderRadius: "5px",
          }}
        >
          <legend style={{ fontWeight: "bold", fontSize: "18px" }}>Datos Básicos del DEA</legend>

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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Latitud *
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                required
                placeholder="40.334922"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Longitud *
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                required
                placeholder="-3.701048"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          {/* Interactive Map for Location Selection */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "500" }}>
              Seleccionar ubicación en el mapa
            </label>
            <LocationPickerMap
              latitude={formData.latitude ? parseFloat(formData.latitude) : 0}
              longitude={formData.longitude ? parseFloat(formData.longitude) : 0}
              onLocationChange={handleLocationChange}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Número Provisional
            </label>
            <input
              type="number"
              name="provisional_number"
              value={formData.provisional_number}
              onChange={handleChange}
              placeholder="Opcional"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Observaciones de Origen
            </label>
            <textarea
              name="origin_observations"
              value={formData.origin_observations}
              onChange={handleChange}
              rows={3}
              placeholder="Observaciones adicionales sobre el origen de los datos"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </fieldset>

        {/* LOCATION DATA */}
        <fieldset
          style={{
            marginBottom: "30px",
            border: "1px solid #ddd",
            padding: "20px",
            borderRadius: "5px",
          }}
        >
          <legend style={{ fontWeight: "bold", fontSize: "18px" }}>Ubicación</legend>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Tipo de Vía *
              </label>
              <select
                name="location_street_type"
                value={formData.location_street_type}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
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
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
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
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
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
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <option value="">Seleccione un distrito</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.district_code} - {district.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Información Adicional
            </label>
            <input
              type="text"
              name="location_additional_info"
              value={formData.location_additional_info}
              onChange={handleChange}
              placeholder="Ej: Acceso por C/Hijas de Jesús"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Descripción del Acceso
            </label>
            <textarea
              name="location_access_description"
              value={formData.location_access_description}
              onChange={handleChange}
              rows={3}
              placeholder="Ej: Entrando al patio por la calle Hijas de Jesús, a la izquierda en el departamento de Tecnología"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Referencias Visibles
            </label>
            <input
              type="text"
              name="location_visible_references"
              value={formData.location_visible_references}
              onChange={handleChange}
              placeholder="Ej: Edificio educativo con acceso desde patio principal"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Piso
              </label>
              <input
                type="text"
                name="location_floor"
                value={formData.location_floor}
                onChange={handleChange}
                placeholder="Ej: Planta Baja"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Ubicación Específica
              </label>
              <input
                type="text"
                name="location_specific_location"
                value={formData.location_specific_location}
                onChange={handleChange}
                placeholder="Ej: Hall de entrada"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>
        </fieldset>

        {/* RESPONSIBLE DATA */}
        <fieldset
          style={{
            marginBottom: "30px",
            border: "1px solid #ddd",
            padding: "20px",
            borderRadius: "5px",
          }}
        >
          <legend style={{ fontWeight: "bold", fontSize: "18px" }}>Responsable</legend>

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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
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
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Teléfono
              </label>
              <input
                type="tel"
                name="responsible_phone"
                value={formData.responsible_phone}
                onChange={handleChange}
                placeholder="+34 600 123 456"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Teléfono Alternativo
              </label>
              <input
                type="tel"
                name="responsible_alternative_phone"
                value={formData.responsible_alternative_phone}
                onChange={handleChange}
                placeholder="+34 600 654 321"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Titularidad DEA *
              </label>
              <select
                name="responsible_ownership"
                value={formData.responsible_ownership}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
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
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
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
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <option value="Público">Público</option>
                <option value="Privado">Privado</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Organización
            </label>
            <input
              type="text"
              name="responsible_organization"
              value={formData.responsible_organization}
              onChange={handleChange}
              placeholder="Ej: Colegio Nuestra Señora de Fátima"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Cargo
              </label>
              <input
                type="text"
                name="responsible_position"
                value={formData.responsible_position}
                onChange={handleChange}
                placeholder="Ej: Coordinadora de Salud"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Departamento
              </label>
              <input
                type="text"
                name="responsible_department"
                value={formData.responsible_department}
                onChange={handleChange}
                placeholder="Ej: Recursos Humanos"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>
        </fieldset>

        {/* SCHEDULE DATA (OPTIONAL) */}
        <fieldset
          style={{
            marginBottom: "30px",
            border: "1px solid #ddd",
            padding: "20px",
            borderRadius: "5px",
          }}
        >
          <legend style={{ fontWeight: "bold", fontSize: "18px" }}>Horario (Opcional)</legend>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="include_schedule"
                checked={formData.include_schedule}
                onChange={handleChange}
                style={{ marginRight: "8px" }}
              />
              <span style={{ fontWeight: "500" }}>Incluir información de horarios</span>
            </label>
          </div>

          {formData.include_schedule && (
            <>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Descripción del Horario
                </label>
                <input
                  type="text"
                  name="schedule_description"
                  value={formData.schedule_description}
                  onChange={handleChange}
                  placeholder="Ej: Horario escolar de lunes a viernes"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    marginBottom: "10px",
                  }}
                >
                  <input
                    type="checkbox"
                    name="schedule_has_24h"
                    checked={formData.schedule_has_24h}
                    onChange={handleChange}
                    style={{ marginRight: "8px" }}
                  />
                  <span>Vigilancia 24 horas</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="schedule_has_restricted"
                    checked={formData.schedule_has_restricted}
                    onChange={handleChange}
                    style={{ marginRight: "8px" }}
                  />
                  <span>Acceso restringido</span>
                </label>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Horario entre semana
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input
                    type="time"
                    name="schedule_weekday_opening"
                    value={formData.schedule_weekday_opening}
                    onChange={handleChange}
                    placeholder="Apertura"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <input
                    type="time"
                    name="schedule_weekday_closing"
                    value={formData.schedule_weekday_closing}
                    onChange={handleChange}
                    placeholder="Cierre"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Horario sábado
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input
                    type="time"
                    name="schedule_saturday_opening"
                    value={formData.schedule_saturday_opening}
                    onChange={handleChange}
                    placeholder="Apertura"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <input
                    type="time"
                    name="schedule_saturday_closing"
                    value={formData.schedule_saturday_closing}
                    onChange={handleChange}
                    placeholder="Cierre"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Horario domingo
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input
                    type="time"
                    name="schedule_sunday_opening"
                    value={formData.schedule_sunday_opening}
                    onChange={handleChange}
                    placeholder="Apertura"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <input
                    type="time"
                    name="schedule_sunday_closing"
                    value={formData.schedule_sunday_closing}
                    onChange={handleChange}
                    placeholder="Cierre"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    marginBottom: "10px",
                  }}
                >
                  <input
                    type="checkbox"
                    name="schedule_closed_holidays"
                    checked={formData.schedule_closed_holidays}
                    onChange={handleChange}
                    style={{ marginRight: "8px" }}
                  />
                  <span>Cerrado en festivos</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="schedule_closed_august"
                    checked={formData.schedule_closed_august}
                    onChange={handleChange}
                    style={{ marginRight: "8px" }}
                  />
                  <span>Cerrado en agosto</span>
                </label>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Observaciones del Horario
                </label>
                <textarea
                  name="schedule_observations"
                  value={formData.schedule_observations}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Observaciones adicionales sobre el horario"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </>
          )}
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
