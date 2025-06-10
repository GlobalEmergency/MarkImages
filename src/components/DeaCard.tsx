'use client'

import React from 'react'
import { Heart, MapPin, Clock, Shield, Edit, Trash2, Eye, Calendar } from 'lucide-react'
import { DeaCardProps } from '@/types'
import { formatShortDate, formatHorario } from '@/utils/helpers'
import { getEstablecimientoTheme } from '@/styles/themes'

const DeaCard: React.FC<DeaCardProps> = ({ record, onEdit, onDelete, onView }) => {
	const theme = getEstablecimientoTheme(record.tipoEstablecimiento)

	return (
		<div
			className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
			style={{
				background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
				border: '1px solid rgba(226, 232, 240, 0.8)'
			}}
		>
			{/* Header con gradiente */}
			<div
				className="relative h-20"
				style={{ background: theme.bg }}
			>
				{/* Patrón decorativo */}
				<div
					className="absolute inset-0 opacity-20"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M0 0h40v40H0V0zm20 20a20 20 0 1 1-40 0 20 20 0 0 1 40 0z'/%3E%3C/g%3E%3C/svg%3E")`
					}}
				/>

				{/* Número DEA flotante */}
				<div
					className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-white font-semibold"
					style={{
						background: 'rgba(255, 255, 255, 0.2)',
						backdropFilter: 'blur(10px)',
						border: '1px solid rgba(255, 255, 255, 0.3)',
						fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
					}}
				>
					<Heart className="w-3 h-3 animate-pulse" />
					#{record.numeroProvisionalDea}
				</div>

				{/* Icono del tipo */}
				<div
					className="absolute bottom-3 left-4"
					style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}
				>
					{theme.icon}
				</div>
			</div>

			{/* Contenido principal */}
			<div
				className="relative"
				style={{
					display: 'grid',
					gap: 'clamp(0.75rem, 2vw, 1rem)',
					padding: 'clamp(1rem, 3vw, 1.5rem)'
				}}
			>
				{/* Título y badge */}
				<div>
					<h3
						className="font-bold text-gray-900 mb-3 leading-tight group-hover:text-gray-700 transition-colors"
						style={{
							fontSize: 'clamp(1rem, 3vw, 1.125rem)',
							lineHeight: '1.3'
						}}
					>
						{record.titularidad}
					</h3>
					<span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${theme.badge}`}>
            <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
            <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
              {record.tipoEstablecimiento}
            </span>
          </span>
				</div>

				{/* Información con iconos mejorados */}
				<div
					style={{
						display: 'grid',
						gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
					}}
				>
					<div className="flex items-start gap-3 text-gray-600 group/item hover:text-gray-800 transition-colors">
						<div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover/item:bg-gray-200 transition-colors">
							<MapPin className="w-4 h-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div
								className="font-medium text-gray-900"
								style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}
							>
								{record.tipoVia} {record.nombreVia} {record.numeroVia}
							</div>
							<div
								className="text-gray-500 truncate"
								style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}
							>
								{record.distrito}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 text-gray-600 group/item hover:text-gray-800 transition-colors">
						<div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover/item:bg-gray-200 transition-colors">
							<Clock className="w-4 h-4" />
						</div>
						<span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>
              {formatHorario(record.aperturaLunesViernes, record.cierreLunesViernes)}
            </span>
					</div>

					{record.vigilante24h === "Sí" && (
						<div className="flex items-center gap-3 text-emerald-600 group/item hover:text-emerald-700 transition-colors">
							<div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover/item:bg-emerald-200 transition-colors">
								<Shield className="w-4 h-4" />
							</div>
							<span
								className="font-medium"
								style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}
							>
                Vigilante 24h disponible
              </span>
						</div>
					)}
				</div>

				{/* Descripción de acceso mejorada */}
				{record.descripcionAcceso && (
					<div
						className="rounded-xl p-3 border-l-4 border-blue-400"
						style={{
							background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
							border: '1px solid rgba(59, 130, 246, 0.1)'
						}}
					>
						<div className="flex items-start gap-2">
							<div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
								<div className="w-2 h-2 rounded-full bg-blue-500"></div>
							</div>
							<div>
								<div
									className="font-medium text-blue-800 mb-1"
									style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}
								>
									Cómo acceder
								</div>
								<p
									className="text-blue-700 leading-relaxed"
									style={{
										fontSize: 'clamp(0.8rem, 2vw, 0.875rem)',
										lineHeight: '1.4'
									}}
								>
									{record.descripcionAcceso}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Botones de acción modernos */}
				<div
					className="flex gap-2 pt-4"
					style={{
						borderTop: '1px solid rgba(226, 232, 240, 0.8)'
					}}
				>
					<button
						onClick={() => onView(record)}
						className="flex-1 group/btn relative overflow-hidden rounded-xl text-white font-medium transition-all duration-300 transform hover:scale-105"
						style={{
							background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
							padding: 'clamp(0.75rem, 2vw, 1rem)',
							fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
							boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.25)'
						}}
					>
						<div className="relative flex items-center justify-center gap-2 z-10">
							<Eye className="w-4 h-4" />
							<span className="hidden sm:inline">Ver Detalles</span>
							<span className="sm:hidden">Detalles</span>
						</div>
						<div
							className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity duration-300"
						></div>
					</button>

					<button
						onClick={() => onEdit(record)}
						title="Editar registro"
						className="group/btn relative overflow-hidden rounded-xl text-gray-600 hover:text-white font-medium transition-all duration-300 transform hover:scale-105"
						style={{
							background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
							padding: 'clamp(0.75rem, 2vw, 1rem)',
							border: '1px solid rgba(209, 213, 219, 0.8)'
						}}
					>
						<div className="relative z-10">
							<Edit className="w-4 h-4" />
						</div>
						<div
							className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
							style={{
								background: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)'
							}}
						></div>
					</button>

					<button
						onClick={() => onDelete(record.id)}
						title="Eliminar registro"
						className="group/btn relative overflow-hidden rounded-xl text-red-500 hover:text-white font-medium transition-all duration-300 transform hover:scale-105"
						style={{
							background: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)',
							padding: 'clamp(0.75rem, 2vw, 1rem)',
							border: '1px solid rgba(239, 68, 68, 0.2)'
						}}
					>
						<div className="relative z-10">
							<Trash2 className="w-4 h-4" />
						</div>
						<div
							className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
							style={{
								background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
							}}
						></div>
					</button>
				</div>

				{/* Fecha en la esquina */}
				<div
					className="flex items-center gap-2 text-gray-400 pt-2"
					style={{
						fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
						borderTop: '1px solid rgba(226, 232, 240, 0.5)'
					}}
				>
					<Calendar className="w-3 h-3" />
					<span>{formatShortDate(record.createdAt)}</span>
				</div>
			</div>

			{/* Efecto hover sutil */}
			<div
				className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
				style={{
					background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%)'
				}}
			></div>
		</div>
	)
}

export default DeaCard
