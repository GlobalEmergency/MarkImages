// types/index.ts

export interface DeaRecord {
	id: number
	horaInicio: string
	horaFinalizacion: string
	correoElectronico: string
	nombre: string
	numeroProvisionalDea: number
	tipoEstablecimiento: string
	titularidadLocal: string
	usoLocal: string
	titularidad: string
	propuestaDenominacion: string
	tipoVia: string
	nombreVia: string
	numeroVia?: string
	complementoDireccion?: string
	codigoPostal: number
	distrito: string
	latitud: number
	longitud: number
	horarioApertura: string
	aperturaLunesViernes: number
	cierreLunesViernes: number
	aperturaSabados: number
	cierreSabados: number
	aperturaDomingos: number
	cierreDomingos: number
	vigilante24h: string
	foto1?: string
	foto2?: string
	descripcionAcceso?: string
	comentarioLibre?: string
	// Campos de Google Maps
	gmTipoVia?: string
	gmNombreVia?: string
	gmNumero?: string
	gmCp?: string
	gmDistrito?: string
	gmLat?: number
	gmLon?: number
	// Campos definitivos
	defTipoVia?: string
	defNombreVia?: string
	defNumero?: string
	defCp?: string
	defDistrito?: string
	defLat?: number
	defLon?: number
	defCodDea?: string
	createdAt: string
	updatedAt: string
}

export interface DeaCardProps {
	record: DeaRecord
	onEdit: (record: DeaRecord) => void
	onDelete: (id: number) => void
	onView: (record: DeaRecord) => void
}

export interface DeaModalProps {
	record: DeaRecord | null
	isOpen: boolean
	onClose: () => void
	onSave: (record: DeaRecord) => Promise<void>
}

export interface EstablecimientoTheme {
	bg: string
	badge: string
	icon: string
	accent: string
}

export interface SearchFiltersProps {
	searchTerm: string
	filterType: string
	onSearchChange: (term: string) => void
	onFilterChange: (type: string) => void
	uniqueTypes: string[]
}

export interface StatsCardProps {
	icon: React.ReactNode
	value: number | string
	label: string
	gradient: string
	borderColor: string
	iconGradient: string
}

export type TipoEstablecimiento =
	| 'Centro educativo'
	| 'Farmacia'
	| 'Otro'
	| 'Otro establecimiento administración pública'
