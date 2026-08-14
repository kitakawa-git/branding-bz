import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // lib/ にもクラス名の定数がある（例: plan-display.ts の PLAN_TONES）。
    // ここを外すと、lib/ にしか無いクラスが CSS に生成されず無視される
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			comfortaa: [
  				'Comfortaa',
  				'sans-serif'
  			],
  			'open-sans': [
  				'Open Sans',
  				'sans-serif'
  			],
  			'noto-sans-jp': [
  				'Noto Sans JP',
  				'sans-serif'
  			]
  		},
  		colors: {
  			teal: {
  				DEFAULT: '#6bcdcf',
  				light: '#8edcdd',
  				dark: '#4fb8ba'
  			},
  			// 公開LP用デザイントークン（DB管理: design_tokens → :root の --ds-*）
  			// 例: text-ds-strong / bg-ds-section。不透明度修飾（/50 等）は使えない点に注意
  			ds: {
  				strong: 'var(--ds-text-strong)',
  				body: 'var(--ds-text-body)',
  				muted: 'var(--ds-text-muted)',
  				meta: 'var(--ds-text-meta)',
  				inverse: 'var(--ds-text-inverse)',
  				accent: 'var(--ds-accent-primary)',
  				base: 'var(--ds-bg-base)',
  				section: 'var(--ds-bg-section)',
  				media: 'var(--ds-bg-media)',
  				// アプリ青アクセント（DB design_tokens(app) → --ds-app-*）
  				// text-ds-app-accent / bg-ds-app-accent / border-ds-app-accent 等で使う
  				'app-accent': 'var(--ds-app-accent)',
  				'app-accent-hover': 'var(--ds-app-accent-hover)',
  				'app-accent-soft': 'var(--ds-app-accent-soft)'
  			},
  			'lp-orange': '#ff6900',
  			'lp-pink': '#f6405f',
  			'lp-gray': {
  				DEFAULT: '#666666',
  				dark: '#5a5a5a',
  				light: '#a4a4a4',
  				bg: '#f9f9f9',
  				bg2: '#f5f5f5'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
