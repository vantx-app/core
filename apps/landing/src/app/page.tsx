import React from 'react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">
            VantX
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium">
            Core
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-slate-100 transition-colors">Características</a>
          <a href="#solutions" className="hover:text-slate-100 transition-colors">Soluciones</a>
          <a href="#about" className="hover:text-slate-100 transition-colors">Nosotros</a>
        </nav>
        <div>
          <a
            href="http://localhost:3000/login"
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 font-semibold text-sm hover:text-white transition-all duration-300"
          >
            Acceder
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-300 text-xs font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Monorepo & Telemetría IoT Activa
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8">
          Conectando el transporte del{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            futuro en tiempo real
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 font-normal leading-relaxed mb-12">
          VantX unifica el rastreo inteligente de flotas con telemetría OBDII/CAN-bus y un ecosistema de emparejamiento instantáneo para conductores profesionales.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="http://localhost:3000/register"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-base shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300"
          >
            Comenzar Ahora
          </a>
          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 font-semibold text-slate-300 hover:text-white transition-all duration-300"
          >
            Saber Más
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative max-w-7xl mx-auto px-6 py-20 z-10">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-16">
          Diseñado para Operaciones de Alta Exigencia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold mb-6">
              📊
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Telemetría en Vivo</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Monitoreo activo de combustible, kilometraje, códigos OBDII y bus de datos CAN mediante hardware Teltonika FMC003/FMC150.
            </p>
          </div>
          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm hover:border-indigo-500/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold mb-6">
              🤝
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Driver Marketplace</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Emparejamiento bidireccional instantáneo entre transportistas y vehículos, garantizando contratos rápidos y fluidos.
            </p>
          </div>
          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm hover:border-emerald-500/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-6">
              🛡️
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Seguridad SSO</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Autenticación unificada mediante cookies seguras HttpOnly cruzando todos los subdominios de la aplicación.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-sm text-slate-600">
        <p>&copy; {new Date().getFullYear()} VantX App. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
