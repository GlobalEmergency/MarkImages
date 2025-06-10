'use client'

import { X, Heart, MapPin, Clock, Shield, Calendar, Mail } from 'lucide-react'
import { DeaModalProps } from '@/types'
import { formatDate, formatHorario, formatFullAddress } from '@/utils/helpers'
import { modalStyles, getEstablecimientoTheme } from '@/styles/themes'

export default function DeaModal({ record, isOpen, onClose }: DeaModalProps) {
	if (!isOpen || !record) return null

	const theme = getEstablecimientoTheme(record.tipoEstablecimiento)

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			style={modalStyles.backdrop}
			onClick={onClose}
		>
			<div
				className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl"
				style={modalStyles.container}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Patrón decorativo */}
				<div
					className="absolute inset-0 opacity-5"
					style={modalStyles.decorativePattern}
				/>

				{/* Header con gradiente */}
				<div
					className="relative h-32"
					style={{ background: theme.bg }}
				>
					{/* Botón cerrar */}
					<button
						onClick={onClose}
						title="Cerrar modal"
						className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform duration-200"
						style={modalStyles.closeButton}
					>
						<X className="w-5 h-5" />
					</button>

					{/* Icono y número DEA */}
					<div className="absolute bottom-4 left-6 flex items-center gap-4">
						<div
							className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
							style={modalStyles.iconContainer}
						>
							{theme.icon}
						</div>
						<div className="text-white">
							<div className="flex items-center gap-2 mb-1">
								<Heart className="w-5 h-5 animate-pulse" />
								<span className="font-bold text-lg">DEA #{record.numeroProvisionalDea}</span>
							</div>
							<div className="opacity-90 text-sm">Desfibrilador Externo Automático</div>
						</div>
					</div>
				</div>

				{/* Contenido principal */}
				<div className="relative p-6 space-y-6">
					{/* Título y tipo */}
					<div>
						<h2 className="text-2xl font-bold text-gray-900 mb-3">
							{record.titularidad}
						</h2>
						<span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium ${theme.badge}`}>
							<div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
							{record.tipoEstablecimiento}
						</span>
					</div>

					{/* Grid de información */}
					<div className="grid md:grid-cols-2 gap-6">
						{/* Información de ubicación */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
								<MapPin className="w-5 h-5 text-blue-500" />
								Ubicación
							</h3>
							<div className="bg-gray-50 rounded-xl p-4 space-y-3">
								<div>
									<div className="font-medium text-gray-900">Dirección</div>
									<div className="text-gray-600">{formatFullAddress(record)}</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<div className="font-medium text-gray-900">Latitud</div>
										<div className="text-gray-600">{record.latitud}</div>
									</div>
									<div>
										<div className="font-medium text-gray-900">Longitud</div>
										<div className="text-gray-600">{record.longitud}</div>
									</div>
								</div>
							</div>
						</div>

						{/* Información de horarios */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
								<Clock className="w-5 h-5 text-green-500" />
								Horarios de Acceso
							</h3>
							<div className="bg-gray-50 rounded-xl p-4 space-y-3">
								<div>
									<div className="font-medium text-gray-900">Lunes a Viernes</div>
									<div className="text-gray-600">
										{formatHorario(record.aperturaLunesViernes, record.cierreLunesViernes)}
									</div>
								</div>
								<div>
									<div className="font-medium text-gray-900">Sábados</div>
									<div className="text-gray-600">
										{formatHorario(record.aperturaSabados, record.cierreSabados)}
									</div>
								</div>
								<div>
									<div className="font-medium text-gray-900">Domingos</div>
									<div className="text-gray-600">
										{formatHorario(record.aperturaDomingos, record.cierreDomingos)}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Información adicional */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-gray-900">Información Adicional</h3>
						<div className="grid md:grid-cols-2 gap-4">
							{/* Vigilancia */}
							<div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
								<div className={`w-10 h-10 rounded-full flex items-center justify-center ${
									record.vigilante24h === 'Sí' ? 'bg-green-100' : 'bg-gray-100'
								}`}>
									<Shield className={`w-5 h-5 ${
										record.vigilante24h === 'Sí' ? 'text-green-600' : 'text-gray-400'
									}`} />
								</div>
								<div>
									<div className="font-medium text-gray-900">Vigilancia 24h</div>
									<div className={`text-sm ${
										record.vigilante24h === 'Sí' ? 'text-green-600' : 'text-gray-500'
									}`}>
										{record.vigilante24h === 'Sí' ? 'Disponible' : 'No disponible'}
									</div>
								</div>
							</div>

							{/* Contacto */}
							<div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
								<div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
									<Mail className="w-5 h-5 text-blue-600" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="font-medium text-gray-900">Contacto</div>
									<div className="text-sm text-gray-600 truncate">{record.correoElectronico}</div>
								</div>
							</div>
						</div>
					</div>

					{/* Descripción de acceso */}
					{record.descripcionAcceso && (
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-gray-900">Instrucciones de Acceso</h3>
							<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
								<p className="text-blue-800 leading-relaxed">{record.descripcionAcceso}</p>
							</div>
						</div>
					)}

					{/* Comentarios */}
					{record.comentarioLibre && (
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-gray-900">Comentarios Adicionales</h3>
							<div className="bg-gray-50 rounded-xl p-4">
								<p className="text-gray-700 leading-relaxed">{record.comentarioLibre}</p>
							</div>
						</div>
					)}

					{/* Información de registro */}
					<div className="pt-4 border-t border-gray-200">
						<div className="flex items-center gap-2 text-gray-500 text-sm">
							<Calendar className="w-4 h-4" />
							<span>Registrado el {formatDate(record.createdAt)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
