'use client'

import { Heart, MapPin, Clock, Shield, Edit, Trash2, Eye } from 'lucide-react'

interface DeaRecord {
	id: number
	numeroProvisionalDea: number
	titularidad: string
	tipoEstablecimiento: string
	tipoVia: string
	nombreVia: string
	numeroVia?: string
	distrito: string
	latitud: number
	longitud: number
	aperturaLunesViernes: number
	cierreLunesViernes: number
	vigilante24h: string
	descripcionAcceso?: string
	createdAt: string
}

interface DeaCardProps {
	record: DeaRecord
	onEdit: (record: DeaRecord) => void
	onDelete: (id: number) => void
	onView: (record: DeaRecord) => void
}

export default function DeaCard({ record, onEdit, onDelete, onView }: DeaCardProps) {
	const getEstablecimientoColor = (tipo: string) => {
		switch (tipo) {
			case 'Centro educativo': return 'bg-blue-100 text-blue-800'
			case 'Farmacia':
			case 'Otro': return 'bg-green-100 text-green-800'
			case 'Otro establecimiento administración pública': return 'bg-purple-100 text-purple-800'
			default: return 'bg-gray-100 text-gray-800'
		}
	}

	return (
		<div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
			<div className="p-6">
				<div className="flex justify-between items-start mb-4">
					<div className="flex-1">
						<div className="flex items-center gap-3 mb-2">
							<Heart className="w-4 h-4 text-red-500 animate-pulse" />
							<span className="text-sm font-medium text-red-600">DEA #{record.numeroProvisionalDea}</span>
						</div>
						<h3 className="text-xl font-bold text-gray-900 mb-2">{record.titularidad}</h3>
						<span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getEstablecimientoColor(record.tipoEstablecimiento)}`}>
              {record.tipoEstablecimiento}
            </span>
					</div>
				</div>

				<div className="space-y-3 mb-4">
					<div className="flex items-center text-gray-600">
						<MapPin className="w-4 h-4 mr-2" />
						<span className="text-sm">{record.tipoVia} {record.nombreVia} {record.numeroVia}, {record.distrito}</span>
					</div>

					<div className="flex items-center text-gray-600">
						<Clock className="w-4 h-4 mr-2" />
						<span className="text-sm">
              {record.aperturaLunesViernes}:00h - {record.cierreLunesViernes}:00h (L-V)
            </span>
					</div>

					{record.vigilante24h === "Sí" && (
						<div className="flex items-center text-green-600">
							<Shield className="w-4 h-4 mr-2" />
							<span className="text-sm font-medium">Vigilante 24h</span>
						</div>
					)}
				</div>

				{record.descripcionAcceso && (
					<div className="bg-gray-50 rounded-lg p-3 mb-4">
						<p className="text-sm text-gray-700">
							<span className="font-medium">Acceso:</span> {record.descripcionAcceso}
						</p>
					</div>
				)}

				<div className="flex gap-2 pt-4 border-t border-gray-100">
					<button
						onClick={() => onView(record)}
						className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
					>
						<Eye className="w-4 h-4" />
						Ver Detalles
					</button>
					<button
						onClick={() => onEdit(record)}
						className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
					>
						<Edit className="w-4 h-4" />
					</button>
					<button
						onClick={() => onDelete(record.id)}
						className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	)
}
