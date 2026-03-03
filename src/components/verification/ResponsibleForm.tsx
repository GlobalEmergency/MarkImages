"use client";

import { Building2, User, Mail, Phone, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ResponsibleFormProps {
  _aedId: string;
  currentResponsible?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    alternative_phone?: string;
    organization?: string;
    position?: string;
    department?: string;
    ownership?: string;
    local_ownership?: string;
    local_use?: string;
    observations?: string;
  };
  onAssignmentComplete: (responsibleData: ResponsibleData) => void;
}

interface ResponsibleData {
  name: string;
  email?: string;
  phone?: string;
  alternative_phone?: string;
  ownership?: string;
  local_ownership?: string;
  local_use?: string;
  organization?: string;
  position?: string;
  department?: string;
  observations?: string;
}

export default function ResponsibleForm({
  _aedId,
  currentResponsible,
  onAssignmentComplete,
}: ResponsibleFormProps) {
  const [formData, setFormData] = useState<ResponsibleData>({
    name: currentResponsible?.name || "",
    email: currentResponsible?.email || "",
    phone: currentResponsible?.phone || "",
    alternative_phone: currentResponsible?.alternative_phone || "",
    ownership: currentResponsible?.ownership || "",
    local_ownership: currentResponsible?.local_ownership || "",
    local_use: currentResponsible?.local_use || "",
    organization: currentResponsible?.organization || "",
    position: currentResponsible?.position || "",
    department: currentResponsible?.department || "",
    observations: currentResponsible?.observations || "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert("El nombre del responsable es obligatorio");
      return;
    }

    setSaving(true);
    try {
      setSaved(true);
      // Parent calls updateStep which triggers a re-render that unmounts us.
      // Keep saving=true so the spinner stays visible until the step transitions.
      onAssignmentComplete(formData);
    } catch (error) {
      console.error("Error saving responsible:", error);
      alert("Error al guardar el responsable");
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Datos del Responsable</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nombre del responsable"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+34 123 456 789"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono Alternativo
            </label>
            <input
              type="tel"
              name="alternative_phone"
              value={formData.alternative_phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+34 987 654 321"
            />
          </div>
        </div>
      </div>

      {/* Organization Information */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Información de la Organización</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organización</label>
            <input
              type="text"
              name="organization"
              value={formData.organization}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nombre de la organización"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Cargo del responsable"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Departamento"
            />
          </div>
        </div>
      </div>

      {/* Ownership Information */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Titularidad y Uso</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titularidad DEA</label>
            <select
              name="ownership"
              value={formData.ownership}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="Público">Público</option>
              <option value="Privado">Privado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titularidad Local
            </label>
            <select
              name="local_ownership"
              value={formData.local_ownership}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="Pública">Pública</option>
              <option value="Privada">Privada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uso del Local</label>
            <select
              name="local_use"
              value={formData.local_use}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="Público">Público</option>
              <option value="Privado">Privado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="bg-white border rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
        <textarea
          name="observations"
          value={formData.observations}
          onChange={handleChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Observaciones adicionales sobre el responsable..."
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between">
        {saved && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Responsable guardado</span>
          </div>
        )}
        <div className="flex-1"></div>
        <button
          type="submit"
          disabled={saving || !formData.name}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Guardando...
            </>
          ) : (
            "Guardar Responsable"
          )}
        </button>
      </div>
    </form>
  );
}
