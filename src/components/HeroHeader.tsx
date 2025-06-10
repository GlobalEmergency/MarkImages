'use client'

import { Heart, Zap, Sparkles } from 'lucide-react'
import { pageStyles } from '@/styles/themes'

export default function HeroHeader() {
	return (
		<header
			className="text-center text-white"
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 'clamp(1rem, 3vw, 2rem)'
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 'clamp(1rem, 3vw, 1.5rem)'
				}}
			>
				<div
					className="relative"
					style={{
						padding: 'clamp(1rem, 3vw, 1.5rem)',
						borderRadius: '50%',
						...pageStyles.heroIcon
					}}
				>
					<Heart
						className="text-red-400 animate-pulse"
						style={{ width: 'clamp(2rem, 6vw, 3rem)', height: 'clamp(2rem, 6vw, 3rem)' }}
					/>
					<div
						className="absolute inset-0 rounded-full"
						style={{
							background: 'conic-gradient(from 0deg, transparent, rgba(248, 113, 113, 0.3), transparent)',
							animation: 'spin 3s linear infinite'
						}}
					></div>
				</div>

				<div>
					<h1
						className="font-black mb-2"
						style={{
							fontSize: 'clamp(2rem, 8vw, 4rem)',
							...pageStyles.heroTitle
						}}
					>
						<span className="text-red-300">DEA</span> Madrid
					</h1>
					<div
						className="flex items-center justify-center gap-2 opacity-90"
						style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}
					>
						<Zap className="w-4 h-4" />
						<span>Sistema Inteligente de Gestión</span>
						<Sparkles className="w-4 h-4" />
					</div>
				</div>
			</div>

			<p
				className="opacity-90 max-w-2xl leading-relaxed"
				style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}
			>
				Plataforma moderna para la gestión y monitoreo de desfibriladores externos automáticos en la Comunidad de Madrid
			</p>

			{/* CSS para animaciones */}
			<style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
		</header>
	)
}
