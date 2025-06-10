'use client'

import { Search, Filter } from 'lucide-react'
import { SearchFiltersProps } from '@/types'
import { inputStyles } from '@/styles/themes'

export default function SearchFilters({
										  searchTerm,
										  filterType,
										  onSearchChange,
										  onFilterChange,
										  uniqueTypes
									  }: SearchFiltersProps) {
	return (
		<div
			className="p-6 rounded-3xl"
			style={{
				background: 'rgba(255, 255, 255, 0.95)',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(255, 255, 255, 0.2)',
				boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
			}}
		>
			<div
				style={{
					display: 'grid',
					gap: 'clamp(1rem, 3vw, 1.5rem)',
					gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
				}}
			>
				{/* Campo de búsqueda */}
				<div style={{ position: 'relative' }}>
					<div
						className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full"
						style={inputStyles.search}
					>
						<Search className="w-4 h-4 text-white" />
					</div>
					<input
						type="text"
						placeholder="Buscar establecimientos, distritos, calles..."
						value={searchTerm}
						onChange={(e) => onSearchChange(e.target.value)}
						className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-300"
						style={{
							fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
							...inputStyles.field
						}}
					/>
				</div>

				{/* Selector de filtros */}
				<div style={{ position: 'relative' }}>
					<div
						className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full"
						style={inputStyles.filter}
					>
						<Filter className="w-4 h-4 text-white" />
					</div>
					<select
						value={filterType}
						onChange={(e) => onFilterChange(e.target.value)}
						className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 appearance-none cursor-pointer"
						style={{
							fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
							...inputStyles.field
						}}
					>
						<option value="">Todos los tipos de establecimiento</option>
						{uniqueTypes.map(type => (
							<option key={type} value={type}>{type}</option>
						))}
					</select>
				</div>
			</div>
		</div>
	)
}
