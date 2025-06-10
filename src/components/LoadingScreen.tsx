'use client'

import { Heart } from 'lucide-react'
import { pageStyles } from '@/styles/themes'

export default function LoadingScreen() {
	return (
		<div
			className="min-h-screen"
			style={{
				display: 'grid',
				placeItems: 'center',
				padding: '1rem',
				background: pageStyles.background
			}}
		>
			<div
				className="text-center p-8 rounded-3xl"
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: '1.5rem',
					...pageStyles.loadingCard
				}}
			>
				<div className="relative">
					<Heart className="w-16 h-16 text-red-500 animate-pulse" />
					<div
						className="absolute inset-0 w-16 h-16 rounded-full"
						style={{
							background: 'conic-gradient(from 0deg, transparent, rgba(239, 68, 68, 0.3), transparent)',
							animation: 'spin 2s linear infinite'
						}}
					></div>
				</div>
				<div>
					<h3
						className="font-bold text-gray-900 mb-2"
						style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)' }}
					>
						Cargando Sistema DEA
					</h3>
					<p
						className="text-gray-600"
						style={{ fontSize: 'clamp(1rem, 3vw, 1.125rem)' }}
					>
						Preparando registros de desfibriladores...
					</p>
				</div>

				{/* CSS para animaciones */}
				<style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
			</div>
		</div>
	)
}
