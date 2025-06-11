// styles/themes.ts

import { EstablecimientoTheme } from '@/types'

export const establecimientoThemes: Record<string, EstablecimientoTheme> = {
	'Centro educativo': {
		bg: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
		badge: 'bg-blue-100 text-blue-800 border border-blue-200',
		icon: '🎓',
		accent: 'blue'
	},
	'Farmacia': {
		bg: 'linear-gradient(135deg, #10B981 0%, #065F46 100%)',
		badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
		icon: '💊',
		accent: 'emerald'
	},
	'Otro': {
		bg: 'linear-gradient(135deg, #10B981 0%, #065F46 100%)',
		badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
		icon: '💊',
		accent: 'emerald'
	},
	'Otro establecimiento administración pública': {
		bg: 'linear-gradient(135deg, #8B5CF6 0%, #5B21B6 100%)',
		badge: 'bg-violet-100 text-violet-800 border border-violet-200',
		icon: '🏛️',
		accent: 'violet'
	},
	default: {
		bg: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
		badge: 'bg-gray-100 text-gray-800 border border-gray-200',
		icon: '🏢',
		accent: 'gray'
	}
}

export const cardStyles = {
	container: {
		background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
		border: '1px solid rgba(226, 232, 240, 0.8)'
	},
	decorativePattern: {
		backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M0 0h40v40H0V0zm20 20a20 20 0 1 1-40 0 20 20 0 0 1 40 0z'/%3E%3C/g%3E%3C/svg%3E")`
	},
	deaBadge: {
		background: 'rgba(255, 255, 255, 0.2)',
		backdropFilter: 'blur(10px)',
		border: '1px solid rgba(255, 255, 255, 0.3)'
	},
	accessInfo: {
		background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
		border: '1px solid rgba(59, 130, 246, 0.1)'
	},
	hoverEffect: {
		background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%)'
	}
}

export const modalStyles = {
	backdrop: {
		background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)',
		backdropFilter: 'blur(8px)'
	},
	container: {
		background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
		boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
		border: '1px solid rgba(226, 232, 240, 0.8)'
	},
	decorativePattern: {
		backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3Ccircle cx='50' cy='10' r='2'/%3E%3Ccircle cx='10' cy='50' r='2'/%3E%3Ccircle cx='50' cy='50' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
	},
	iconContainer: {
		background: 'rgba(255, 255, 255, 0.2)',
		backdropFilter: 'blur(10px)',
		border: '1px solid rgba(255, 255, 255, 0.3)'
	},
	closeButton: {
		background: 'rgba(255, 255, 255, 0.2)',
		backdropFilter: 'blur(10px)',
		border: '1px solid rgba(255, 255, 255, 0.3)'
	}
}

export const pageStyles = {
	background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
	backgroundPattern: {
		backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
	},
	heroIcon: {
		background: 'rgba(255, 255, 255, 0.2)',
		backdropFilter: 'blur(20px)',
		border: '2px solid rgba(255, 255, 255, 0.3)'
	},
	heroTitle: {
		background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
		backgroundClip: 'text',
		WebkitBackgroundClip: 'text',
		color: 'transparent'
	},
	card: {
		background: 'rgba(255, 255, 255, 0.95)',
		backdropFilter: 'blur(20px)',
		border: '1px solid rgba(255, 255, 255, 0.2)',
		boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
	},
	loadingCard: {
		background: 'rgba(255, 255, 255, 0.95)',
		backdropFilter: 'blur(20px)',
		border: '1px solid rgba(255, 255, 255, 0.2)',
		boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
	}
}

export const buttonStyles = {
	primary: {
		background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
		boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.25)'
	},
	secondary: {
		background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
		border: '1px solid rgba(209, 213, 219, 0.8)'
	},
	danger: {
		background: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)',
		border: '1px solid rgba(239, 68, 68, 0.2)'
	},
	secondaryHover: {
		background: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)'
	},
	dangerHover: {
		background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
	}
}

export const statsCardGradients = {
	red: {
		background: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)',
		border: '2px solid rgba(239, 68, 68, 0.1)',
		boxShadow: '0 10px 25px -3px rgba(239, 68, 68, 0.1)',
		iconGradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
	},
	green: {
		background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
		border: '2px solid rgba(34, 197, 94, 0.1)',
		boxShadow: '0 10px 25px -3px rgba(34, 197, 94, 0.1)',
		iconGradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
	},
	blue: {
		background: 'linear-gradient(135deg, #F0F9FF 0%, #DBEAFE 100%)',
		border: '2px solid rgba(59, 130, 246, 0.1)',
		boxShadow: '0 10px 25px -3px rgba(59, 130, 246, 0.1)',
		iconGradient: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)'
	},
	purple: {
		background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
		border: '2px solid rgba(139, 92, 246, 0.1)',
		boxShadow: '0 10px 25px -3px rgba(139, 92, 246, 0.1)',
		iconGradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
	}
}

export const inputStyles = {
	search: {
		background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)'
	},
	filter: {
		background: 'linear-gradient(135deg, #10B981 0%, #065F46 100%)'
	},
	field: {
		background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
	}
}

export const getEstablecimientoTheme = (tipo: string): EstablecimientoTheme => {
	return establecimientoThemes[tipo] || establecimientoThemes.default
}
