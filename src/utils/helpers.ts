// utils/helpers.ts

import { DeaRecord } from '@/types'

export const formatDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString('es-ES', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

export const formatShortDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString('es-ES', {
		day: 'numeric',
		month: 'short'
	})
}

export const filterRecords = (
	records: DeaRecord[],
	searchTerm: string,
	filterType: string
): DeaRecord[] => {
	return records.filter(record => {
		const matchesSearch = record.titularidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
			record.distrito.toLowerCase().includes(searchTerm.toLowerCase()) ||
			record.nombreVia.toLowerCase().includes(searchTerm.toLowerCase())
		const matchesFilter = filterType === '' || record.tipoEstablecimiento === filterType
		return matchesSearch && matchesFilter
	})
}

export const getUniqueTypes = (records: DeaRecord[]): string[] => {
	return [...new Set(records.map(r => r.tipoEstablecimiento))]
}

export const getUniqueDistricts = (records: DeaRecord[]): string[] => {
	return [...new Set(records.map(r => r.distrito))]
}

export const getVigilante24hCount = (records: DeaRecord[]): number => {
	return records.filter(r => r.vigilante24h === 'Sí').length
}

export const formatHorario = (apertura: number, cierre: number): string => {
	return `${apertura}:00h - ${cierre}:00h`
}

export const formatAddress = (record: DeaRecord): string => {
	return `${record.tipoVia} ${record.nombreVia} ${record.numeroVia || ''}, ${record.distrito}`
}

export const formatFullAddress = (record: DeaRecord): string => {
	return `${record.tipoVia} ${record.nombreVia} ${record.numeroVia || ''}\n${record.codigoPostal} - ${record.distrito}`
}

export const formatCoordinates = (lat: number, lng: number): { lat: string, lng: string } => {
	return {
		lat: lat.toString(),
		lng: lng.toString()
	}
}

export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

export const isValidPostalCode = (postalCode: number): boolean => {
	return postalCode >= 10000 && postalCode <= 99999
}

export const truncateText = (text: string, maxLength: number): string => {
	if (text.length <= maxLength) return text
	return text.slice(0, maxLength) + '...'
}

export const generateDeaCode = (): number => {
	return Math.floor(Math.random() * 9000) + 1000
}

export const validateDeaRecord = (record: Partial<DeaRecord>): string[] => {
	const errors: string[] = []

	if (!record.titularidad) errors.push('El nombre del establecimiento es obligatorio')
	if (!record.tipoEstablecimiento) errors.push('El tipo de establecimiento es obligatorio')
	if (!record.nombreVia) errors.push('El nombre de la vía es obligatorio')
	if (!record.distrito) errors.push('El distrito es obligatorio')
	if (record.correoElectronico && !isValidEmail(record.correoElectronico)) {
		errors.push('El email no tiene un formato válido')
	}
	if (record.codigoPostal && !isValidPostalCode(record.codigoPostal)) {
		errors.push('El código postal no es válido')
	}

	return errors
}

export const sortRecordsByDate = (records: DeaRecord[], ascending: boolean = false): DeaRecord[] => {
	return [...records].sort((a, b) => {
		const dateA = new Date(a.createdAt).getTime()
		const dateB = new Date(b.createdAt).getTime()
		return ascending ? dateA - dateB : dateB - dateA
	})
}

export const sortRecordsByDistrict = (records: DeaRecord[]): DeaRecord[] => {
	return [...records].sort((a, b) => a.distrito.localeCompare(b.distrito))
}

export const groupRecordsByType = (records: DeaRecord[]): Record<string, DeaRecord[]> => {
	return records.reduce((acc, record) => {
		const type = record.tipoEstablecimiento
		if (!acc[type]) acc[type] = []
		acc[type].push(record)
		return acc
	}, {} as Record<string, DeaRecord[]>)
}

export const groupRecordsByDistrict = (records: DeaRecord[]): Record<string, DeaRecord[]> => {
	return records.reduce((acc, record) => {
		const district = record.distrito
		if (!acc[district]) acc[district] = []
		acc[district].push(record)
		return acc
	}, {} as Record<string, DeaRecord[]>)
}

export const calculateDistance = (
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number => {
	const R = 6371 // Radio de la Tierra en km
	const dLat = (lat2 - lat1) * Math.PI / 180
	const dLng = (lng2 - lng1) * Math.PI / 180
	const a =
		Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng/2) * Math.sin(dLng/2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
	return R * c
}

/**
 * Note: The following functions have been commented out as they're not currently used in the application.
 * They are preserved for potential future use but removed from the bundle to optimize performance.
 */

/*
export const findNearestDea = (
	userLat: number,
	userLng: number,
	records: DeaRecord[]
): DeaRecord | null => {
	if (records.length === 0) return null

	let nearest = records[0]
	let minDistance = calculateDistance(userLat, userLng, nearest.latitud, nearest.longitud)

	for (let i = 1; i < records.length; i++) {
		const distance = calculateDistance(userLat, userLng, records[i].latitud, records[i].longitud)
		if (distance < minDistance) {
			minDistance = distance
			nearest = records[i]
		}
	}

	return nearest
}

export const exportToCSV = (records: DeaRecord[]): string => {
	const headers = [
		'ID', 'Número DEA', 'Establecimiento', 'Tipo', 'Dirección',
		'Distrito', 'Código Postal', 'Latitud', 'Longitud',
		'Horario L-V', 'Vigilante 24h', 'Descripción Acceso', 'Fecha Registro'
	]

	const csvContent = [
		headers.join(','),
		...records.map(record => [
			record.id,
			record.numeroProvisionalDea,
			`"${record.titularidad}"`,
			`"${record.tipoEstablecimiento}"`,
			`"${formatAddress(record)}"`,
			`"${record.distrito}"`,
			record.codigoPostal,
			record.latitud,
			record.longitud,
			`"${formatHorario(record.aperturaLunesViernes, record.cierreLunesViernes)}"`,
			record.vigilante24h,
			`"${record.descripcionAcceso || ''}"`,
			`"${formatDate(record.createdAt)}"`
		].join(','))
	].join('\n')

	return csvContent
}

export const downloadCSV = (records: DeaRecord[], filename: string = 'dea-records.csv'): void => {
	const csvContent = exportToCSV(records)
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
	const link = document.createElement('a')

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', filename)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}
}
*/
