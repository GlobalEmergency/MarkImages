'use client'

import { Heart, Users, Building, MapPin } from 'lucide-react'
import { DeaRecord } from '@/types'
import { getVigilante24hCount, getUniqueTypes, getUniqueDistricts } from '@/utils/helpers'
import { statsCardGradients } from '@/styles/themes'
import StatsCard from './StatsCard'

interface StatsDashboardProps {
	records: DeaRecord[]
}

export default function StatsDashboard({ records }: StatsDashboardProps) {
	const vigilante24hCount = getVigilante24hCount(records)
	const uniqueTypesCount = getUniqueTypes(records).length
	const uniqueDistrictsCount = getUniqueDistricts(records).length

	return (
		<div
			className="rounded-3xl p-6"
			style={{
				background: 'rgba(255, 255, 255, 0.95)',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(255, 255, 255, 0.2)',
				boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
			}}
		>
			<h2
				className="font-bold text-gray-900 mb-6 text-center"
				style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)' }}
			>
				📊 Dashboard en Tiempo Real
			</h2>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
					gap: 'clamp(1rem, 3vw, 1.5rem)'
				}}
			>
				<StatsCard
					icon={<Heart className="w-8 h-8" />}
					value={records.length}
					label="DEAs Registrados"
					gradient={statsCardGradients.red.background}
					borderColor={statsCardGradients.red.border}
					iconGradient={statsCardGradients.red.iconGradient}
				/>

				<StatsCard
					icon={<Users className="w-8 h-8" />}
					value={vigilante24hCount}
					label="Vigilancia 24/7"
					gradient={statsCardGradients.green.background}
					borderColor={statsCardGradients.green.border}
					iconGradient={statsCardGradients.green.iconGradient}
				/>

				<StatsCard
					icon={<Building className="w-8 h-8" />}
					value={uniqueTypesCount}
					label="Tipos de Centros"
					gradient={statsCardGradients.blue.background}
					borderColor={statsCardGradients.blue.border}
					iconGradient={statsCardGradients.blue.iconGradient}
				/>

				<StatsCard
					icon={<MapPin className="w-8 h-8" />}
					value={uniqueDistrictsCount}
					label="Distritos Cubiertos"
					gradient={statsCardGradients.purple.background}
					borderColor={statsCardGradients.purple.border}
					iconGradient={statsCardGradients.purple.iconGradient}
				/>
			</div>
		</div>
	)
}
