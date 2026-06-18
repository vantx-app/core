"use client";

import React, { useState } from "react";
import {
  Shield,
  Zap,
  Activity,
  Info,
  Truck,
  Car,
  Settings,
  Flame,
  Wrench,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

interface Rule {
  code: string;
  pillar: string;
  threshold?: number;
  maxThreshold?: number;
  maxDeduction: number;
  deductionPer100Km?: number;
  deductionPerEvent?: number;
  deductionPerSeverityUnit?: number;
  deductionFixed?: number;
}

interface Pillars {
  SAFETY: { weight: number; baseScore: number };
  EFFICIENCY: { weight: number; baseScore: number };
  ASSET_CARE: { weight: number; baseScore: number };
}

interface ScoringProfile {
  id: string;
  name: string;
  rulesEngine: {
    engineVersion: string;
    pillars: Pillars;
    rules: Rule[];
  };
}

interface Props {
  scoringProfiles: any[];
}

const SPANISH_PILLARS = {
  SAFETY: {
    name: "Seguridad Vial",
    desc: "Mide hábitos de conducción segura (frenados bruscos, velocidad y giros agresivos) para reducir la siniestralidad.",
    colorClass: "text-rose-600 bg-rose-50 border-rose-100",
    progressClass: "progress-error",
    icon: Shield,
  },
  EFFICIENCY: {
    name: "Eficiencia de Operación",
    desc: "Optimiza el consumo de combustible, controlando ralentí excesivo y aceleraciones desmedidas.",
    colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100",
    progressClass: "progress-success",
    icon: Zap,
  },
  ASSET_CARE: {
    name: "Cuidado del Activo",
    desc: "Protege la vida útil mecánica (sobreesfuerzo en frío, revoluciones excesivas y desconexión de telemetría).",
    colorClass: "text-indigo-600 bg-indigo-50 border-indigo-100",
    progressClass: "progress-primary",
    icon: Activity,
  },
};

const SPANISH_RULES: Record<string, { name: string; desc: string; icon: any }> =
  {
    OVERSPEEDING: {
      name: "Exceso de velocidad",
      desc: "Conducir superando el límite máximo parametrizado para la categoría.",
      icon: Flame,
    },
    HARSH_BRAKING: {
      name: "Frenado brusco",
      desc: "Desaceleración repentina del vehículo superior a la fuerza G recomendada.",
      icon: AlertTriangle,
    },
    HARSH_CORNERING: {
      name: "Giro brusco",
      desc: "Cambio lateral intempestivo de dirección medido por el acelerómetro.",
      icon: AlertTriangle,
    },
    HARSH_ACCELERATION: {
      name: "Aceleración brusca",
      desc: "Incremento excesivo de velocidad en corto tiempo que desperdicia combustible.",
      icon: Zap,
    },
    HIGH_RPM: {
      name: "Altas RPM",
      desc: "Operación continuada del motor a revoluciones por encima del torque óptimo.",
      icon: Settings,
    },
    EXCESSIVE_IDLING: {
      name: "Ralentí excesivo",
      desc: "Mantener el motor encendido con el vehículo detenido (pérdida de combustible).",
      icon: Info,
    },
    DEVICE_UNPLUGGED: {
      name: "Dispositivo desconectado",
      desc: "Detección de sabotaje o desconexión física del hardware Teltonika OBD/CAN.",
      icon: Wrench,
    },
    COLD_ENGINE_STRAIN: {
      name: "Esfuerzo con motor frío",
      desc: "Exigir aceleraciones severas antes de que el motor alcance la temperatura operativa.",
      icon: Settings,
    },
    COASTING_IN_NEUTRAL: {
      name: "Conducción en neutro",
      desc: "Dejar rodar el camión en neutro, lo cual inhabilita el freno de motor y reduce control.",
      icon: HelpCircle,
    },
    ENGINE_LUGGING: {
      name: "Sobreesfuerzo a bajas RPM",
      desc: "Acelerar fuertemente a RPMs extremadamente bajas, fatigando la transmisión.",
      icon: Settings,
    },
    HIGH_LOAD_STRAIN: {
      name: "Esfuerzo con alta carga",
      desc: "Conducción inapropiada que genera sobrecalentamiento bajo carga pesada.",
      icon: Settings,
    },
    CRITICAL_OVERHEATING: {
      name: "Sobrecalentamiento crítico",
      desc: "Operación por encima de la temperatura crítica permitida del refrigerante.",
      icon: Flame,
    },
    ACTIVE_FAULT_CODES: {
      name: "Códigos de falla activos",
      desc: "Alertas activas del motor (Check Engine, fallas críticas de sensores CAN-bus).",
      icon: Wrench,
    },
  };

export function ScoringRulesInteractive({ scoringProfiles }: Props) {
  // Categorías de vehículos
  const categories = [
    { code: "HEAVY_DUTY", name: "Equipo Pesado (HDV)", icon: Truck },
    { code: "LIGHT_COMMERCIAL", name: "Comercial Ligero (LCV)", icon: Truck },
    { code: "PASSENGER", name: "Automóviles", icon: Car },
    { code: "MACHINERY", name: "Maquinaria Pesada", icon: Settings },
  ];

  const [selectedCategory, setSelectedCategory] = useState("HEAVY_DUTY");
  const [fuelType, setFuelType] = useState<"GASOLINE" | "DIESEL">("DIESEL");

  // Buscar el perfil correspondiente basado en los nombres sembrados en la base de datos
  const getActiveProfile = (): ScoringProfile | null => {
    let targetName = "DEFAULT";

    if (selectedCategory === "MACHINERY") {
      targetName = "DEFAULT_MACHINERY";
    } else if (selectedCategory === "HEAVY_DUTY") {
      targetName = fuelType === "DIESEL" ? "DEFAULT_HDV_DIESEL" : "DEFAULT_HDV";
    } else if (selectedCategory === "LIGHT_COMMERCIAL") {
      targetName = fuelType === "DIESEL" ? "DEFAULT_LCV_DIESEL" : "DEFAULT_LCV";
    } else if (selectedCategory === "PASSENGER") {
      targetName =
        fuelType === "DIESEL"
          ? "DEFAULT_PASSENGER_DIESEL"
          : "DEFAULT_PASSENGER";
    }

    const found = scoringProfiles.find(
      (p) => p.name.toUpperCase() === targetName.toUpperCase(),
    );

    // Retorna fallback si no se encuentra
    return found || scoringProfiles.find((p) => p.name === "DEFAULT") || null;
  };

  const activeProfile = getActiveProfile();
  const rules = activeProfile?.rulesEngine?.rules || [];
  const pillars = activeProfile?.rulesEngine?.pillars || {
    SAFETY: { weight: 0.4, baseScore: 100 },
    EFFICIENCY: { weight: 0.1, baseScore: 100 },
    ASSET_CARE: { weight: 0.5, baseScore: 100 },
  };

  // Formatear reglas para display
  const getDeductionText = (rule: Rule) => {
    if (rule.deductionPer100Km !== undefined && rule.deductionPer100Km > 0) {
      return `-${rule.deductionPer100Km} pts / 100 km`;
    }
    if (rule.deductionPerEvent !== undefined && rule.deductionPerEvent > 0) {
      return `-${rule.deductionPerEvent} pts / evento`;
    }
    if (
      rule.deductionPerSeverityUnit !== undefined &&
      rule.deductionPerSeverityUnit > 0
    ) {
      return `-${rule.deductionPerSeverityUnit} pts / unidad de gravedad`;
    }
    if (rule.deductionFixed !== undefined && rule.deductionFixed > 0) {
      return `-${rule.deductionFixed} pts (Fijo)`;
    }
    return "Variable";
  };

  const getThresholdText = (rule: Rule) => {
    if (rule.code === "OVERSPEEDING" && rule.threshold) {
      return `Límite de vía + 12 km/h`;
    }
    if (rule.code === "HIGH_RPM" && rule.threshold) {
      return `> ${rule.threshold} RPM`;
    }
    if (rule.code === "EXCESSIVE_IDLING") {
      return `> 5 min continuo`;
    }
    if (rule.threshold) {
      return `> ${rule.threshold} mG`;
    }
    return "Inmediato";
  };

  return (
    <div
      className="w-full max-w-7xl mx-auto px-6 py-20 z-10 border-t border-slate-200/80"
      id="reglas"
    >
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/50">
          Transparencia y Objetividad
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-4 mb-4">
          Reglas del Motor de Scoring Dinámico
        </h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          Nuestros cálculos de desempeño de conductores están parametrizados
          directamente por tipo de vehículo y tipo de combustible. A
          continuación, puedes consultar las penalizaciones y ponderaciones
          dinámicas que rigen el sistema en tiempo real.
        </p>
      </div>

      {/* Selectores Interactivos */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        {/* Categorías de Vehículo */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = selectedCategory === cat.code;
            return (
              <button
                key={cat.code}
                onClick={() => setSelectedCategory(cat.code)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <IconComponent className="size-4" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Tipo de Combustible (Solo si aplica) */}
        {selectedCategory !== "MACHINERY" && (
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto justify-center">
            <button
              onClick={() => setFuelType("DIESEL")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                fuelType === "DIESEL"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Motor Diésel
            </button>
            <button
              onClick={() => setFuelType("GASOLINE")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                fuelType === "GASOLINE"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Motor Gasolina / Estándar
            </button>
          </div>
        )}
      </div>

      {/* Distribución de Pilares (Ponderación) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {(
          Object.keys(SPANISH_PILLARS) as Array<keyof typeof SPANISH_PILLARS>
        ).map((key) => {
          const pillarInfo = SPANISH_PILLARS[key];
          const dbPillar = pillars[key] || { weight: 0.33, baseScore: 100 };
          const Icon = pillarInfo.icon;
          const weightPercentage = Math.round(dbPillar.weight * 100);

          return (
            <div
              key={key}
              className="glass-card p-6 bg-white/85 border border-slate-200 rounded-2xl flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-300"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`p-2.5 rounded-xl border ${pillarInfo.colorClass}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="text-2xl font-black text-slate-850">
                    {weightPercentage}%{" "}
                    <span className="text-xs text-slate-400 font-normal">
                      peso
                    </span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {pillarInfo.name}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {pillarInfo.desc}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Influencia en Score General</span>
                  <span>{weightPercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      key === "SAFETY"
                        ? "bg-rose-500"
                        : key === "EFFICIENCY"
                          ? "bg-emerald-500"
                          : "bg-indigo-500"
                    }`}
                    style={{ width: `${weightPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reglas Específicas */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h4 className="text-sm font-bold text-slate-800">
            Reglas de Penalización Aplicadas ({rules.length} activas)
          </h4>
          <span className="badge badge-sm py-1 font-mono text-[9px] bg-slate-250 border-none text-slate-700 uppercase">
            Motor v{activeProfile?.rulesEngine?.engineVersion || "0.1"}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {rules.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No hay reglas específicas activadas en este perfil.
            </div>
          ) : (
            rules.map((rule) => {
              const ruleMeta = SPANISH_RULES[rule.code] || {
                name: rule.code,
                desc: "Regla personalizada del motor de telemetría.",
                icon: HelpCircle,
              };
              const pillarMeta = SPANISH_PILLARS[
                rule.pillar as keyof typeof SPANISH_PILLARS
              ] || {
                name: rule.pillar,
                colorClass: "bg-slate-100 text-slate-600",
              };
              const RuleIcon = ruleMeta.icon;

              return (
                <div
                  key={rule.code}
                  className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  {/* Regla Detalle */}
                  <div className="flex items-start gap-4 max-w-xl">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                      <RuleIcon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <h5 className="text-sm font-bold text-slate-900">
                          {ruleMeta.name}
                        </h5>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            rule.pillar === "SAFETY"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : rule.pillar === "EFFICIENCY"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}
                        >
                          {pillarMeta.name}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs leading-relaxed">
                        {ruleMeta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Parámetros Técnicos */}
                  <div className="grid grid-cols-3 gap-6 text-left md:text-right shrink-0 md:w-80 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold font-sans">
                        Umbral
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {getThresholdText(rule)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold font-sans">
                        Deducción
                      </span>
                      <span className="text-xs font-bold text-rose-600">
                        {getDeductionText(rule)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold font-sans">
                        Límite Máx
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {rule.maxDeduction} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Caso Especial: Exceso de Velocidad */}
      <div className="mt-6 bg-amber-50/60 border border-amber-200/80 rounded-2xl p-6">
        <div className="flex gap-3 items-start">
          <div className="p-2 bg-amber-100 border border-amber-200 text-amber-800 rounded-lg shrink-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-amber-900 mb-2">
              💡 Caso Especial: Regulación y Tolerancias de Velocidad
            </h5>
            <p className="text-xs text-amber-800 leading-relaxed mb-4">
              A diferencia de otros parámetros fijos, las infracciones por
              exceso de velocidad se calculan en base a una lógica espacial y
              temporal inteligente integrada con HERE Maps y la regulación de
              tránsito nacional:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-700">
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50">
                <strong className="text-slate-900 block mb-1">
                  Límite de Vía Dinámico
                </strong>
                Se consulta en tiempo real el límite de la vía exacta donde
                circula el vehículo, discriminando entre automóviles y
                transporte de carga pesada.
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50">
                <strong className="text-slate-900 block mb-1">
                  Tolerancia de Gracia
                </strong>
                El sistema aplica un margen de gracia de{" "}
                <strong>+12 km/h</strong> sobre el límite de la vía. La
                penalización se activa únicamente si se supera este umbral.
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50">
                <strong className="text-slate-900 block mb-1">
                  Ventana de Desaceleración
                </strong>
                Si el límite de la vía cae repentinamente (20 km/h o más), se
                concede una ventana de gracia de <strong>15 segundos</strong>{" "}
                para reducir la velocidad sin penalizaciones.
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50">
                <strong className="text-slate-900 block mb-1">
                  Duración de Infracción
                </strong>
                El exceso de velocidad debe sostenerse de forma continua durante
                al menos <strong>5 segundos</strong> para ser registrado como un
                episodio de exceso.
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 lg:col-span-2">
                <strong className="text-slate-900 block mb-1">
                  Límite Respaldo (Panamá Art. 165)
                </strong>
                Fuera de rutas digitalizadas o sin señal, aplica el Smart
                Fallback de tránsito: <strong>90 km/h</strong> en autopistas,{" "}
                <strong>60 km/h</strong> en avenidas principales,{" "}
                <strong>50 km/h</strong> en secundarias y{" "}
                <strong>40 km/h</strong> en zonas residenciales/industriales.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información de Soporte y Metodología */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8">
        <div>
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="size-4 text-blue-600" />
            ¿Cómo se calcula el Scoring Semanal?
          </h4>
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <p>
              Cada conductor inicia su ciclo de evaluación semanal con una
              puntuación base de <strong>100 puntos</strong> en cada uno de los
              tres pilares fundamentales.
            </p>
            <p>
              <strong>Normalización y Suavizado (Prior Bayesiano)</strong>: Las
              penalizaciones por eventos severos (frenadas, aceleraciones y
              giros bruscos) se normalizan por cada 100 km recorridos. Para
              evitar que un solo evento en un viaje corto (ej. 2 km) arruine la
              puntuación, el sistema aplica un "Prior Bayesiano" sumando{" "}
              <strong>100 km de amortiguación</strong> a la distancia total
              antes del cálculo. A mayor distancia recorrida, el promedio
              converge al comportamiento real, premiando la constancia. En el
              caso del <strong>Ralentí Excesivo</strong>, la telemetría lo
              registra tras <strong>5 minutos continuos</strong> con el motor
              encendido y el vehículo detenido; luego, el motor de reglas
              acumula esta duración y aplica la penalización por cada bloque de{" "}
              <strong>15 minutos acumulados</strong> durante la semana.
            </p>
            <p>
              <strong>Gravedad Promediada de Eventos</strong>: Ciertas reglas
              (como los giros, aceleraciones y frenadas severas) no solo cuentan
              las veces que ocurren, sino que miden la <em>fuerza G</em> del
              sensor en <strong>mili-G (mG)</strong> (donde 1000 mG = 1G de
              aceleración terrestre). Esta intensidad se acumula y se normaliza
              bajo el mismo prior de distancia para calcular la deducción
              proporcional al riesgo real del evento.
            </p>
            <p>
              Las deducciones calculadas se restan del puntaje del pilar
              correspondiente. Las deducciones en un mismo pilar tienen límites
              máximos establecidos (el <strong>Límite Máx</strong>) para evitar
              que eventos aislados penalicen desproporcionadamente la nota
              semanal.
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Settings className="size-4 text-emerald-600" />
            Cálculo Ponderado del Score General
          </h4>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              El <strong>Score General</strong> es una media ponderada que
              refleja el equilibrio entre el comportamiento de seguridad vial y
              la eficiencia:
            </p>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 font-mono text-[11px] text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Score General =</span>
                <span className="font-bold text-blue-600">
                  (S × W<sub>s</sub>) + (E × W<sub>e</sub>) + (C × W<sub>c</sub>
                  )
                </span>
              </div>
              <div className="space-y-1 text-slate-500 text-[10px]">
                <div className="flex justify-between">
                  <span>S = Seguridad Vial</span>
                  <span>
                    W<sub>s</sub> = Peso Seguridad (
                    {Math.round((pillars.SAFETY?.weight || 0.4) * 100)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>E = Eficiencia de Operación</span>
                  <span>
                    W<sub>e</sub> = Peso Eficiencia (
                    {Math.round((pillars.EFFICIENCY?.weight || 0.1) * 100)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>C = Cuidado del Activo</span>
                  <span>
                    W<sub>c</sub> = Peso Cuidado (
                    {Math.round((pillars.ASSET_CARE?.weight || 0.5) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              * Nota: Si un vehículo circula menos de 1.0 km durante el período
              de evaluación semanal, el sistema mantiene una calificación
              neutral por defecto para no penalizar la inactividad del
              conductor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
