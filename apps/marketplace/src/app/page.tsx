import React from "react";

// Mock drivers for demonstration
const DRIVERS = [
  {
    id: "1",
    name: "Carlos Mendoza",
    rating: 4.9,
    trips: 142,
    status: "Disponible",
    zone: "Zona Norte",
    type: "Carga Pesada",
  },
  {
    id: "2",
    name: "Sofía Rodríguez",
    rating: 4.8,
    trips: 98,
    status: "En Ruta",
    zone: "Zona Centro",
    type: "Distribución",
  },
  {
    id: "3",
    name: "Andrés Castiblanco",
    rating: 4.7,
    trips: 230,
    status: "Disponible",
    zone: "Zona Sur",
    type: "Carga Pesada",
  },
  {
    id: "4",
    name: "Mariana Silva",
    rating: 4.95,
    trips: 180,
    status: "Disponible",
    zone: "Zona Oeste",
    type: "Refrigerados",
  },
];

export default function MarketplaceHome() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              VantX Marketplace
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              SSO Activo
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="http://localhost:3000"
              className="text-sm font-semibold hover:text-white text-slate-400 transition-colors"
            >
              Volver al Panel CRM
            </a>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300">
              U
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Asignaciones en Tiempo Real
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Encuentre conductores calificados e inicie contratos de servicio
              al instante. Todos los perfiles son validados mediante firma
              digital e historial telemático.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/10">
              Crear Oferta de Trabajo
            </button>
            <button className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all">
              Ver Mis Contratos
            </button>
          </div>
        </div>
      </section>

      {/* Grid Content */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80">
              <h2 className="text-lg font-bold text-white mb-4">Filtros</h2>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">
                    TIPO DE VEHÍCULO
                  </label>
                  <select className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-blue-500">
                    <option>Todos</option>
                    <option>Carga Pesada</option>
                    <option>Distribución</option>
                    <option>Refrigerados</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">
                    ZONA GEOGRÁFICA
                  </label>
                  <select className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-blue-500">
                    <option>Todas</option>
                    <option>Zona Norte</option>
                    <option>Zona Centro</option>
                    <option>Zona Sur</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          {/* Drivers List */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Conductores Disponibles
              </h2>
              <span className="text-sm text-slate-400">
                {DRIVERS.length} conductores encontrados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DRIVERS.map((driver) => (
                <div
                  key={driver.id}
                  className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/60 transition-all duration-300 flex flex-col justify-between gap-6"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        {driver.name}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {driver.type} &bull; {driver.zone}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        driver.status === "Disponible"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {driver.status}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="grid grid-cols-2 gap-4 border-y border-slate-800/50 py-4">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                        CALIFICACIÓN
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        ⭐ {driver.rating}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                        VIAJES COMPLETADOS
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {driver.trips} viajes
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-3">
                    <button className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-all">
                      Ver Perfil
                    </button>
                    <button className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/5">
                      Proponer Contrato
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-6 text-center text-xs text-slate-600 bg-slate-900/60">
        <p>
          &copy; {new Date().getFullYear()} VantX Drivers Marketplace. Todos los
          derechos reservados.
        </p>
      </footer>
    </main>
  );
}
