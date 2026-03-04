"use client";

import { Building2, ChevronDown } from "lucide-react";

interface UserOrganization {
  id: string;
  name: string;
  type: string;
  role: string;
  can_verify: boolean;
}

interface OrganizationSelectorProps {
  organizations: UserOrganization[];
  selectedOrgId: string | null;
  onChange: (orgId: string | null) => void;
}

export default function OrganizationSelector({
  organizations,
  selectedOrgId,
  onChange,
}: OrganizationSelectorProps) {
  if (organizations.length === 0) {
    return null;
  }

  // If only one organization, show it as a badge (not a selector)
  if (organizations.length === 1) {
    const org = organizations[0];
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-sm text-blue-600 font-medium">Verificando para:</div>
            <div className="text-base font-semibold text-blue-900">{org.name}</div>
          </div>
        </div>
      </div>
    );
  }

  // Multiple organizations: show dropdown
  const selectedOrg = selectedOrgId ? organizations.find((org) => org.id === selectedOrgId) : null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <label htmlFor="org-selector" className="block text-sm text-blue-600 font-medium mb-2">
        <Building2 className="w-4 h-4 inline mr-1" />
        Verificando para:
      </label>
      <div className="relative">
        <select
          id="org-selector"
          value={selectedOrgId || "all"}
          onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
          className="w-full appearance-none bg-white border border-blue-300 rounded-lg px-4 py-2.5 pr-10 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          <option value="all">Todas mis organizaciones ({organizations.length})</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>
      {selectedOrg && (
        <div className="mt-2 text-xs text-blue-600">
          Mostrando solo DEAs asignados a {selectedOrg.name}
        </div>
      )}
    </div>
  );
}
