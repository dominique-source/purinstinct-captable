import React, { useState, useMemo } from "react";
import { Scale, Info, Check } from "lucide-react";

/**
 * Section VALORISATION PRE-REVENUE — purinstinct-captable
 * 4 méthodes standards : Berkus, Scorecard (Payne), Risk Factor Summation, Méthode VC.
 * Prérempli avec le profil PürInstinct (juillet 2026) — tout est ajustable.
 * Prop optionnelle onApply(value) : applique la valo comme pre-money / cap SAFE dans le reste de l'app.
 */

const LIME = "#CCFF00";
const fmt = (n) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

/* ── Primitives ── */

function Row({ label, hint, value, min, max, step, onChange, format }) {
  return (
    <div className="py-3 border-b border-[#1D1D1D] last:border-0">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[#F2F2ED]">{label}</div>
          {hint && <div className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed">{hint}</div>}
        </div>
        <span className="font-mono text-[13px] text-[#CCFF00] font-semibold whitespace-nowrap">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ "--thumb": LIME }}
      />
    </div>
  );
}

function Result({ label, value, note, onApply, applied }) {
  return (
    <div className="mt-5 bg-[#0D0D0D] border border-[#CCFF00]/25 rounded-xl p-5 text-center">
      <div className="text-[10.5px] tracking-[0.18em] text-[#8A8A85] font-semibold uppercase">{label}</div>
      <div className="disp italic font-black text-[38px] sm:text-[46px] leading-none text-[#CCFF00] mt-2">
        {fmt(value)}
      </div>
      {note && <div className="text-[11.5px] text-[#6B6B66] mt-2 leading-relaxed">{note}</div>}
      {onApply && (
        <button
          onClick={() => onApply(value)}
          className={`mt-4 inline-flex items-center gap-1.5 text-[12px] rounded-full px-4 py-1.5 border transition-colors ${
            applied
              ? "border-[#CCFF00] text-[#CCFF00]"
              : "border-[#2A2A2A] text-[#9A9A94] hover:border-[#CCFF00] hover:text-[#CCFF00]"
          }`}
        >
          {applied ? <><Check size={12} /> Appliqué au pre-money / cap SAFE</> : "Utiliser comme pre-money / cap SAFE"}
        </button>
      )}
    </div>
  );
}

/* ── Données par méthode (préremplies PürInstinct) ── */

const BERKUS = [
  { label: "Idée / proposition de valeur", hint: "Sport enregistré, 10+ ans de développement, positionnement « Hyrox des sports instinctifs »", v: 400000 },
  { label: "Prototype / produit fonctionnel", hint: "Le sport opère réellement : 150+ écoles, formats d'événements validés sur le terrain", v: 450000 },
  { label: "Qualité de l'équipe", hint: "2 fondateurs temps plein (dont ex-pro All-Canadian), 2 collaborateurs temps partiel", v: 350000 },
  { label: "Relations stratégiques", hint: "JV Moment Factory avancée (non signée), Séan Garnier exploratoire", v: 250000 },
  { label: "Traction / lancement", hint: "10 000+ participants cumulés, réseau scolaire actif — mais pre-revenue", v: 300000 },
];

const SCORECARD = [
  { label: "Force de l'équipe", w: 0.30, hint: "Fondateur crédible dans le sport, 10 ans d'exécution — équipe partiellement temps partiel", v: 115 },
  { label: "Taille de l'opportunité", w: 0.25, hint: "Sport participatif + média + événementiel ; vague Kings League / Baller League", v: 120 },
  { label: "Produit / technologie", w: 0.15, hint: "Sport enregistré + marque déposée + droits d'auteur ; formats validés", v: 110 },
  { label: "Environnement concurrentiel", w: 0.10, hint: "Peu de concurrents directs en 3v2 no-contact ; barrière = 10 ans d'avance", v: 110 },
  { label: "Marketing / partenariats", w: 0.10, hint: "Réseau scolaire établi, MF avancée non signée, créateurs exploratoires", v: 100 },
  { label: "Besoin de financement additionnel", w: 0.05, hint: "750 k$ visés ; d'autres rondes nécessaires avant profitabilité", v: 90 },
  { label: "Autres (traction, timing, IP)", w: 0.05, hint: "10 000+ participants sans capital externe = efficacité rare", v: 115 },
];

const RISKS = [
  { label: "Gestion", hint: "Fondateur expérimenté ; C-suite en cours de définition", v: 1 },
  { label: "Stade de l'entreprise", hint: "Pre-revenue malgré 10 ans d'opérations terrain", v: 0 },
  { label: "Législatif / politique", hint: "Cadre scolaire et événementiel stable au Québec", v: 1 },
  { label: "Production / opérations", hint: "Formats validés, logique de mutualisation établie", v: 1 },
  { label: "Financement", hint: "Première levée externe ; dépendance à la ronde de 750 k$", v: -1 },
  { label: "Concurrence", hint: "Fenêtre Kings League : des acteurs mieux financés pourraient entrer", v: 0 },
  { label: "Technologie", hint: "Faible dépendance techno ; la JV MF apporterait la couche augmentée", v: 1 },
  { label: "Litige", hint: "IP protégée : marque déposée + droits d'auteur", v: 1 },
  { label: "International", hint: "Expansion hors Québec non prouvée", v: -1 },
  { label: "Réputation", hint: "10 ans de crédibilité dans le réseau scolaire québécois", v: 1 },
  { label: "Potentiel de sortie", hint: "Acquéreurs plausibles, mais marché de sorties sport-tech mince au Canada", v: 0 },
  { label: "Macroéconomique", hint: "Budgets scolaires et municipaux sensibles aux cycles", v: 0 },
];

const METHOD_INFO = {
  berkus: "Méthode Berkus (Dave Berkus) : jusqu'à 500 k$ par facteur de réduction de risque, plafond ≈ 2,5 M$. La plus conservatrice — utile comme plancher de négociation.",
  scorecard: "Méthode Scorecard (Bill Payne) : part de la valorisation médiane des comparables pre-seed de la région, ajustée facteur par facteur (100 % = dans la moyenne). Base suggérée : 3,5 M$ CAD — pre-seed canadien hors IA, sport-tech/consumer 2025-2026.",
  risk: "Risk Factor Summation : même base médiane, ajustée sur 12 catégories de risque notées de −2 à +2. Chaque cran vaut ±250 k$.",
  vc: "Méthode VC : raisonne à rebours depuis la sortie. Post-money = valeur de sortie ÷ multiple de retour visé (10–20× en pre-seed). Pre-money = post-money − ronde.",
};

/* ── Section principale ── */

export default function Valuation({ onApply }) {
  const [tab, setTab] = useState("scorecard");
  const [appliedValue, setAppliedValue] = useState(null);

  // Berkus
  const [berkus, setBerkus] = useState(BERKUS.map((d) => d.v));
  const berkusTotal = berkus.reduce((a, b) => a + b, 0);

  // Scorecard
  const [scBase, setScBase] = useState(3500000);
  const [sc, setSc] = useState(SCORECARD.map((d) => d.v));
  const scMult = SCORECARD.reduce((acc, f, i) => acc + f.w * (sc[i] / 100), 0);
  const scTotal = Math.round((scBase * scMult) / 10000) * 10000;

  // Risk factor
  const [rfBase, setRfBase] = useState(3500000);
  const [rf, setRf] = useState(RISKS.map((d) => d.v));
  const rfAdj = rf.reduce((a, b) => a + b, 0) * 250000;
  const rfTotal = Math.max(0, rfBase + rfAdj);

  // VC
  const [exitVal, setExitVal] = useState(40000000);
  const [multiple, setMultiple] = useState(15);
  const [raise, setRaise] = useState(750000);
  const vcPost = exitVal / multiple;
  const vcPre = Math.max(0, Math.round((vcPost - raise) / 10000) * 10000);
  const vcDilution = (raise / vcPost) * 100;

  const allResults = useMemo(
    () => [
      { key: "berkus", label: "Berkus", value: berkusTotal },
      { key: "scorecard", label: "Scorecard", value: scTotal },
      { key: "risk", label: "Risk Factor", value: rfTotal },
      { key: "vc", label: "Méthode VC", value: vcPre },
    ],
    [berkusTotal, scTotal, rfTotal, vcPre]
  );
  const lo = Math.min(...allResults.map((r) => r.value));
  const hi = Math.max(...allResults.map((r) => r.value));
  const avg = Math.round(allResults.reduce((a, r) => a + r.value, 0) / 4 / 10000) * 10000;

  const apply = onApply
    ? (v) => { onApply(v); setAppliedValue(v); }
    : null;

  const TABS = [
    { key: "berkus", label: "Berkus" },
    { key: "scorecard", label: "Scorecard" },
    { key: "risk", label: "Risk Factor" },
    { key: "vc", label: "Méthode VC" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-16">
      <div className="flex items-center gap-2 mb-1">
        <Scale size={14} className="text-[#CCFF00]" />
        <span className="text-[11px] tracking-[0.25em] text-[#CCFF00] font-semibold">VALORISATION PRE-REVENUE</span>
      </div>
      <p className="text-[#9A9A94] text-sm max-w-2xl leading-relaxed mb-6">
        Quatre méthodes standards de l'industrie pour valoriser une startup sans revenus. Chaque méthode
        éclaire un angle différent — présente la fourchette croisée plutôt qu'un chiffre unique en négociation.
      </p>

      {/* Sélecteur de méthode */}
      <div role="tablist" aria-label="Méthodes de valorisation" className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={`disp italic font-black text-[14px] tracking-wide uppercase rounded-lg px-4 py-2 border transition-colors ${
                on
                  ? "bg-[#CCFF00] text-[#0D0D0D] border-[#CCFF00]"
                  : "bg-transparent text-[#9A9A94] border-[#2A2A2A] hover:border-[#CCFF00]/50 hover:text-[#F2F2ED]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
        {/* Panneau méthode active */}
        <div className="bg-[#111111] border border-[#232323] rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-2 text-[11.5px] text-[#8A8A85] leading-relaxed mb-4 bg-[#0D0D0D] border border-[#1D1D1D] rounded-lg px-3 py-2.5">
            <Info size={13} className="text-[#CCFF00] flex-shrink-0 mt-0.5" />
            <span>{METHOD_INFO[tab]}</span>
          </div>

          {tab === "berkus" && (
            <>
              {BERKUS.map((d, i) => (
                <Row key={i} label={d.label} hint={d.hint} value={berkus[i]} min={0} max={500000} step={25000}
                  onChange={(v) => setBerkus(berkus.map((x, j) => (j === i ? v : x)))} format={fmt} />
              ))}
              <Result label="Pre-money — Berkus" value={berkusTotal}
                note="Plafond méthodologique ≈ 2,5 M$." onApply={apply} applied={appliedValue === berkusTotal} />
            </>
          )}

          {tab === "scorecard" && (
            <>
              <Row label="Valorisation médiane de base (comparables)" hint="Pre-seed Canada, sport-tech / consumer / média"
                value={scBase} min={1500000} max={8000000} step={100000} onChange={setScBase} format={fmt} />
              {SCORECARD.map((f, i) => (
                <Row key={i} label={`${f.label} — pondération ${Math.round(f.w * 100)} %`} hint={f.hint}
                  value={sc[i]} min={50} max={150} step={5}
                  onChange={(v) => setSc(sc.map((x, j) => (j === i ? v : x)))} format={(v) => `${v} %`} />
              ))}
              <Result label="Pre-money — Scorecard" value={scTotal}
                note={`Multiplicateur combiné : ${(scMult * 100).toFixed(0)} % de la médiane`}
                onApply={apply} applied={appliedValue === scTotal} />
            </>
          )}

          {tab === "risk" && (
            <>
              <Row label="Valorisation médiane de base" value={rfBase} min={1500000} max={8000000} step={100000}
                onChange={setRfBase} format={fmt} />
              {RISKS.map((f, i) => (
                <Row key={i} label={f.label} hint={f.hint} value={rf[i]} min={-2} max={2} step={1}
                  onChange={(v) => setRf(rf.map((x, j) => (j === i ? v : x)))}
                  format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
              ))}
              <Result label="Pre-money — Risk Factor" value={rfTotal}
                note={`Ajustement net : ${rfAdj >= 0 ? "+" : "−"}${fmt(Math.abs(rfAdj))} sur la base`}
                onApply={apply} applied={appliedValue === rfTotal} />
            </>
          )}

          {tab === "vc" && (
            <>
              <Row label="Valeur de sortie estimée (5–8 ans)" hint="Acquisition ou valorisation à maturité — appuie-toi sur les projections PürInstinct Games (EBITDA cible 35–41 %)"
                value={exitVal} min={10000000} max={150000000} step={5000000} onChange={setExitVal} format={fmt} />
              <Row label="Multiple de retour attendu" hint="Pre-seed : 10–20× pour compenser le taux d'échec du portefeuille"
                value={multiple} min={5} max={30} step={1} onChange={setMultiple} format={(v) => `${v}×`} />
              <Row label="Montant de la ronde" value={raise} min={250000} max={2000000} step={50000}
                onChange={setRaise} format={fmt} />
              <Result label="Pre-money — Méthode VC" value={vcPre}
                note={`Post-money ${fmt(vcPost)} · dilution implicite ${vcDilution.toFixed(1)} % (médiane pre-seed : ~15–20 %)`}
                onApply={apply} applied={appliedValue === vcPre} />
            </>
          )}
        </div>

        {/* Synthèse croisée */}
        <div className="bg-[#111111] border border-[#232323] rounded-2xl p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="text-[11px] tracking-[0.2em] text-[#CCFF00] font-semibold mb-4">SYNTHÈSE — 4 MÉTHODES</div>
          <div className="space-y-2.5 mb-5">
            {allResults.map((r) => {
              const pct = hi > lo ? ((r.value - lo) / (hi - lo)) * 100 : 100;
              const on = r.key === tab;
              return (
                <button key={r.key} onClick={() => setTab(r.key)} className="w-full text-left group">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className={`text-[12px] font-medium transition-colors ${on ? "text-[#CCFF00]" : "text-[#9A9A94] group-hover:text-[#F2F2ED]"}`}>
                      {r.label}
                    </span>
                    <span className="font-mono text-[12.5px] text-[#F2F2ED]">{fmt(r.value)}</span>
                  </div>
                  <div className="h-1.5 bg-[#1D1D1D] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(pct, 4)}%`, background: on ? LIME : "#3A3A3A" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#1D1D1D] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-[#9A9A94]">Fourchette</span>
              <span className="font-mono text-[13px] text-[#F2F2ED]">{fmt(lo)} – {fmt(hi)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[12px] text-[#9A9A94]">Moyenne des 4 méthodes</span>
              <span className="disp italic font-black text-[22px] text-[#CCFF00]">{fmt(avg)}</span>
            </div>
            {apply && (
              <button
                onClick={() => apply(avg)}
                className={`mt-3 w-full text-[12px] rounded-lg px-3 py-2 border transition-colors ${
                  appliedValue === avg
                    ? "border-[#CCFF00] text-[#CCFF00]"
                    : "border-[#2A2A2A] text-[#9A9A94] hover:border-[#CCFF00] hover:text-[#CCFF00]"
                }`}
              >
                {appliedValue === avg ? "✓ Moyenne appliquée au pre-money / cap SAFE" : "Utiliser la moyenne comme pre-money / cap SAFE"}
              </button>
            )}
          </div>

          <p className="text-[10.5px] text-[#6B6B66] leading-relaxed mt-4">
            Outil indicatif basé sur des méthodologies standards (Berkus, Payne Scorecard, Risk Factor
            Summation, méthode VC). Ne constitue pas une évaluation certifiée — la valorisation finale
            se détermine par négociation.
          </p>
        </div>
      </div>
    </div>
  );
}
