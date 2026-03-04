"use client";

import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";

export default function OrgSelector() {
  const { selectedOrganization, setSelectedOrganization, organizations, hasOrganizations } =
    useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (!hasOrganizations) {
    return null;
  }

  // Si solo tiene una organización, mostrar sin dropdown
  if (organizations.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {selectedOrganization?.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {selectedOrganization?.name}
          </p>
          <p className="text-xs text-gray-600 truncate">{selectedOrganization?.type}</p>
        </div>
      </div>
    );
  }

  // Si tiene múltiples organizaciones, mostrar dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors active:scale-98"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {selectedOrganization?.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {selectedOrganization?.name}
          </p>
          <p className="text-xs text-gray-600 truncate">{selectedOrganization?.type}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay para cerrar al hacer click fuera */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menú dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
            <div className="py-1">
              {organizations.map((org) => {
                const isSelected = selectedOrganization?.id === org.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrganization(org);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={`text-sm font-medium truncate ${
                          isSelected ? "text-blue-700" : "text-gray-900"
                        }`}
                      >
                        {org.name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {org.type} • {org.role}
                      </p>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
