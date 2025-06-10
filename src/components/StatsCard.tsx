'use client'

import { StatsCardProps } from '@/types'

export default function StatsCard({
									  icon,
									  value,
									  label,
									  gradient,
									  borderColor,
									  iconGradient
								  }: StatsCardProps) {
	return (
		<div
			className="group text-center p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105"
			style={{
				background: gradient,
				border: borderColor,
				boxShadow: borderColor.replace('border:', 'boxShadow:').replace('0.1)', '0.1)')
			}}
		>
			<div
				className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
				style={{ background: iconGradient }}
			>
				<div className="text-white" style={{ width: '2rem', height: '2rem' }}>
					{icon}
				</div>
			</div>
			<div
				className="font-black mb-2"
				style={{
					fontSize: 'clamp(2rem, 6vw, 3rem)',
					color: iconGradient.includes('EF4444') ? '#DC2626' :
						iconGradient.includes('22C55E') ? '#16A34A' :
							iconGradient.includes('3B82F6') ? '#1E40AF' : '#7C3AED'
				}}
			>
				{value}
			</div>
			<div
				className="font-semibold"
				style={{
					fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
					color: iconGradient.includes('EF4444') ? '#EF4444' :
						iconGradient.includes('22C55E') ? '#22C55E' :
							iconGradient.includes('3B82F6') ? '#3B82F6' : '#8B5CF6'
				}}
			>
				{label}
			</div>
		</div>
	)
}
