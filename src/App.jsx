import React, { useState, useMemo, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Trash2, Info, TrendingUp, ShieldCheck, ChevronDown, RotateCcw, Users, History } from "lucide-react";
import { db, authReady, firebaseEnabled } from "./firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";

const FOUNDER_COLORS = ["#CCFF00", "#7C9EFF", "#FF6B6B", "#4FD1C5", "#F5A623", "#C792EA"];

const FACTORS = [
  { key: "idea", label: "Idée / IP d'origine", hint: "Qui a créé le concept ou l'actif initial" },
  { key: "time", label: "Engagement temps plein", hint: "% du temps consacré à l'entreprise" },
  { key: "risk", label: "Risque assumé", hint: "Salaire sacrifié, capital personnel investi" },
  { key: "execution", label: "Compétences critiques", hint: "Construit / opère le cœur du produit" },
  { key: "capital", label: "Capital apporté", hint: "Argent injecté dans l'entreprise" },
  { key: "network", label: "Réseau / actifs", hint: "Clients, distribution, relations stratégiques" },
];

const DEFAULT_WEIGHTS = { idea: 15, time: 25, risk: 20, execution: 20, capital: 10, network: 10 };
const SALARY_WEIGHTS = { idea: 20, time: 18, risk: 8, execution: 24, capital: 15, network: 15 };

const defaultFounder = (name, role, color, seed) => ({
  id: crypto.randomUUID(),
  name,
  role,
  color,
  stockClass: "A",
  factors: { idea: seed.idea, time: seed.time, risk: seed.risk, execution: seed.execution, capital: seed.capital, network: seed.network },
  marketSalary: seed.marketSalary,
  salaireAnnuel: seed.salaireAnnuel ?? 0,
});

const getInitialFounders = () => [
  defaultFounder("Dominique Soucy", "Fondateur & CEO", FOUNDER_COLORS[0], {
    idea: 10, time: 10, risk: 10, execution: 8, capital: 6, network: 9, marketSalary: 140000, salaireAnnuel: 60000,
  }),
  defaultFounder("Collaborateur clé", "Rôle à définir", FOUNDER_COLORS[1], {
    idea: 3, time: 7, risk: 4, execution: 8, capital: 1, network: 5, marketSalary: 95000, salaireAnnuel: 55000,
  }),
];

// ---- C-SUITE ROLES SECTION ----
const CSUITE_ROLES = [
  {
    key: "ceo",
    title: "CEO",
    scope: "Vision, stratégie, capital",
    desc: "Vision produit et règles du sport, arbitrage stratégique entre PürInstinct, Games et INSTINCT, décisions de capital et partenariats structurants.",
    fte: "Temps plein",
  },
  {
    key: "coo",
    title: "COO",
    scope: "Business development & opérations stratégiques",
    desc: "Partenaire direct du CEO — développement d'affaires, partenariats, présence dans les rencontres stratégiques, structuration des opérations à l'échelle de l'entreprise. Ne gère pas l'exécution terrain des événements (voir Logistique & production événement).",
    fte: "Temps plein",
  },
  {
    key: "cfo",
    title: "CFO",
    scope: "Finance & gouvernance",
    desc: "Modélisation financière, structuration de la levée, reporting investisseur, conformité.",
    fte: "Fractionnaire possible",
  },
  {
    key: "cmo",
    title: "CMO",
    scope: "Marque & croissance",
    desc: "Positionnement de marque, stratégie de contenu et réseaux, coordination du narratif entre Games et INSTINCT.",
    fte: "Temps plein ou fractionnaire",
  },
  {
    key: "logistics",
    title: "Logistique & production événement",
    scope: "Exécution terrain",
    desc: "Propriétaire complet de l'événementiel — calendrier des événements, billetterie, matériel, animation et formation des coachs sur site. Rôle distinct du COO, qui se concentre sur le développement d'affaires.",
    fte: "Temps plein",
  },
  {
    key: "creative",
    title: "Creative director",
    scope: "Direction créative",
    desc: "Langage visuel, expérience de marque, direction artistique des événements et du contenu diffusé (Games + INSTINCT).",
    fte: "Temps plein ou fractionnaire",
  },
];

const csuiteColor = (i) => FOUNDER_COLORS[i % FOUNDER_COLORS.length];

const defaultCsuiteState = () => {
  const st = {};
  CSUITE_ROLES.forEach((r, i) => {
    st[r.key] = {
      name: "",
      fteShare: 100, // % of full-time equivalent — lets you mark someone as 0.5 FTE etc.
      factors: { idea: 3, time: 6, risk: 3, execution: 6, capital: 1, network: 3 },
      color: csuiteColor(i),
      cliffMonths: 12,
      vestMonths: 48,
    };
  });
  return st;
};

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export default function EquitySplitStudio() {
  const [method, setMethod] = useState("value");
  const [founders, setFounders] = useState(getInitialFounders);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [esopPool, setEsopPool] = useState(12);
  const [cliffMonths, setCliffMonths] = useState(12);
  const [vestMonths, setVestMonths] = useState(48);
  const [expandedId, setExpandedId] = useState(founders[0]?.id ?? null);
  const [showMethodInfo, setShowMethodInfo] = useState(false);
  const [showFunding, setShowFunding] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(500000);
  const [preMoney, setPreMoney] = useState(4000000);
  const [topUpPool, setTopUpPool] = useState(true);
  const [topUpTarget, setTopUpTarget] = useState(15);

  // C-suite section state
  const [csuite, setCsuite] = useState(defaultCsuiteState);
  const [csuiteWeights, setCsuiteWeights] = useState(DEFAULT_WEIGHTS);
  const [csuiteTab, setCsuiteTab] = useState("individual"); // "individual" | "category"
  const [csuiteEsop, setCsuiteEsop] = useState(12);

  // C-suite Seed Round (SAFE) simulation
  const [showCsuiteSeed, setShowCsuiteSeed] = useState(false);
  const [csuiteSeedRaise, setCsuiteSeedRaise] = useState(500000);
  const [csuiteSeedCap, setCsuiteSeedCap] = useState(4000000);
  const [csuiteSeedTopUpPool, setCsuiteSeedTopUpPool] = useState(true);
  const [csuiteSeedTopUpTarget, setCsuiteSeedTopUpTarget] = useState(15);

  // Historique (Firebase) — snapshots automatiques de l'état complet
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const restoringRef = useRef(false);
  const lastSavedRef = useRef(null);
  const saveTimerRef = useRef(null);

  const resetAll = () => {
    const fresh = getInitialFounders();
    setMethod("value");
    setFounders(fresh);
    setWeights(DEFAULT_WEIGHTS);
    setEsopPool(12);
    setCliffMonths(12);
    setVestMonths(48);
    setExpandedId(fresh[0].id);
    setShowMethodInfo(false);
    setShowFunding(false);
    setRaiseAmount(500000);
    setPreMoney(4000000);
    setTopUpPool(true);
    setTopUpTarget(15);
    setCsuite(defaultCsuiteState());
    setCsuiteWeights(DEFAULT_WEIGHTS);
    setCsuiteTab("individual");
    setCsuiteEsop(12);
    setShowCsuiteSeed(false);
    setCsuiteSeedRaise(500000);
    setCsuiteSeedCap(4000000);
    setCsuiteSeedTopUpPool(true);
    setCsuiteSeedTopUpTarget(15);
  };

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  const csuiteWeightTotal = Object.values(csuiteWeights).reduce((a, b) => a + b, 0);

  const updateFounder = (id, patch) =>
    setFounders((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const updateFactor = (id, key, value) =>
    setFounders((fs) =>
      fs.map((f) => (f.id === id ? { ...f, factors: { ...f.factors, [key]: value } } : f))
    );

  const addFounder = () => {
    if (founders.length >= 6) return;
    const color = FOUNDER_COLORS[founders.length % FOUNDER_COLORS.length];
    const nf = defaultFounder("Nouveau contributeur", "Rôle à définir", color, {
      idea: 2, time: 5, risk: 3, execution: 5, capital: 0, network: 3, marketSalary: 80000,
    });
    setFounders((fs) => [...fs, nf]);
    setExpandedId(nf.id);
  };

  const removeFounder = (id) => {
    if (founders.length <= 1) return;
    setFounders((fs) => fs.filter((f) => f.id !== id));
  };

  const results = useMemo(() => {
    const available = 100 - esopPool;
    if (method === "flat") {
      const each = available / founders.length;
      return founders.map((f) => ({ ...f, pct: each, rawScore: null }));
    }
    if (method === "market") {
      const total = founders.reduce((s, f) => s + f.marketSalary, 0) || 1;
      return founders.map((f) => ({ ...f, pct: (f.marketSalary / total) * available, rawScore: f.marketSalary }));
    }
    const scores = founders.map((f) => {
      const raw = FACTORS.reduce((s, fac) => s + f.factors[fac.key] * (weights[fac.key] || 0), 0);
      return { id: f.id, raw };
    });
    const totalRaw = scores.reduce((s, x) => s + x.raw, 0) || 1;
    return founders.map((f) => {
      const raw = scores.find((s) => s.id === f.id).raw;
      return { ...f, pct: (raw / totalRaw) * available, rawScore: raw };
    });
  }, [founders, weights, method, esopPool]);

  const pieData = useMemo(() => {
    const arr = results.map((r) => ({ name: r.name, value: Number(r.pct.toFixed(2)), color: r.color }));
    arr.push({ name: "Pool ESOP (réserve)", value: esopPool, color: "#3A3A3A" });
    return arr;
  }, [results, esopPool]);

  const classA = results.filter((r) => r.stockClass === "A").reduce((s, r) => s + r.pct, 0);
  const classB = results.filter((r) => r.stockClass === "B").reduce((s, r) => s + r.pct, 0);

  const fundingResults = useMemo(() => {
    const investorPct = (raiseAmount / (preMoney + raiseAmount)) * 100;
    const remainingBeforeInvestor = 100 - investorPct;
    const currentFounderTotal = 100 - esopPool;
    const targetPool = topUpPool ? Math.max(esopPool, topUpTarget) : esopPool;
    const founderTotalAfterTopUp = 100 - targetPool;
    const shrinkFactor = currentFounderTotal > 0 ? founderTotalAfterTopUp / currentFounderTotal : 1;
    const adjustedFounders = results.map((r) => ({ ...r, preRoundPct: r.pct * shrinkFactor }));
    const adjustedPool = targetPool;
    const factor = remainingBeforeInvestor / 100;
    const foundersOut = adjustedFounders.map((r) => ({ ...r, postPct: r.preRoundPct * factor }));
    const poolPost = adjustedPool * factor;
    return { investorPct, founders: foundersOut, poolPost, postMoney: preMoney + raiseAmount };
  }, [results, esopPool, raiseAmount, preMoney, topUpPool, topUpTarget]);

  // ---- C-suite calculations ----
  const updateCsuiteFactor = (key, factorKey, value) =>
    setCsuite((c) => ({ ...c, [key]: { ...c[key], factors: { ...c[key].factors, [factorKey]: value } } }));

  const updateCsuiteField = (key, patch) =>
    setCsuite((c) => ({ ...c, [key]: { ...c[key], ...patch } }));

  const csuiteResults = useMemo(() => {
    const available = 100 - csuiteEsop;
    const scores = CSUITE_ROLES.map((r) => {
      const f = csuite[r.key];
      const rawFullTime = FACTORS.reduce((s, fac) => s + f.factors[fac.key] * (csuiteWeights[fac.key] || 0), 0);
      // scale by FTE share — someone at 50% time gets 50% of their raw score
      const raw = rawFullTime * (f.fteShare / 100);
      return { key: r.key, raw };
    });
    const totalRaw = scores.reduce((s, x) => s + x.raw, 0) || 1;
    return CSUITE_ROLES.map((r) => {
      const raw = scores.find((s) => s.key === r.key).raw;
      const pct = (raw / totalRaw) * available;
      return { ...r, ...csuite[r.key], pct, raw };
    });
  }, [csuite, csuiteWeights, csuiteEsop]);

  const csuitePieData = useMemo(() => {
    const arr = csuiteResults.map((r) => ({ name: r.name || r.title, value: Number(r.pct.toFixed(2)), color: r.color }));
    arr.push({ name: "Pool ESOP (réserve)", value: csuiteEsop, color: "#3A3A3A" });
    return arr;
  }, [csuiteResults, csuiteEsop]);

  // Seed Round (SAFE, valuation cap post-money) — dilution appliquée à la structure de direction
  const csuiteSeedResults = useMemo(() => {
    const investorPct = csuiteSeedCap > 0 ? (csuiteSeedRaise / csuiteSeedCap) * 100 : 0;
    const remainingBeforeInvestor = 100 - investorPct;
    const currentTotal = 100 - csuiteEsop;
    const targetPool = csuiteSeedTopUpPool ? Math.max(csuiteEsop, csuiteSeedTopUpTarget) : csuiteEsop;
    const totalAfterTopUp = 100 - targetPool;
    const shrinkFactor = currentTotal > 0 ? totalAfterTopUp / currentTotal : 1;
    const factor = remainingBeforeInvestor / 100;
    const roles = csuiteResults.map((r) => {
      const preRoundPct = r.pct * shrinkFactor;
      return { ...r, preRoundPct, postPct: preRoundPct * factor };
    });
    const poolPost = targetPool * factor;
    return { investorPct, roles, poolPost, postMoney: csuiteSeedCap };
  }, [csuiteResults, csuiteEsop, csuiteSeedRaise, csuiteSeedCap, csuiteSeedTopUpPool, csuiteSeedTopUpTarget]);

  const snapshotState = () => ({
    method, founders, weights, esopPool, cliffMonths, vestMonths,
    raiseAmount, preMoney, topUpPool, topUpTarget,
    csuite, csuiteWeights, csuiteEsop,
    csuiteSeedRaise, csuiteSeedCap, csuiteSeedTopUpPool, csuiteSeedTopUpTarget,
  });

  const restoreSnapshot = (snap) => {
    restoringRef.current = true;
    setMethod(snap.method);
    setFounders(snap.founders);
    setWeights(snap.weights);
    setEsopPool(snap.esopPool);
    setCliffMonths(snap.cliffMonths);
    setVestMonths(snap.vestMonths);
    setRaiseAmount(snap.raiseAmount);
    setPreMoney(snap.preMoney);
    setTopUpPool(snap.topUpPool);
    setTopUpTarget(snap.topUpTarget);
    setCsuite(snap.csuite);
    setCsuiteWeights(snap.csuiteWeights);
    setCsuiteEsop(snap.csuiteEsop);
    setCsuiteSeedRaise(snap.csuiteSeedRaise ?? 500000);
    setCsuiteSeedCap(snap.csuiteSeedCap ?? 4000000);
    setCsuiteSeedTopUpPool(snap.csuiteSeedTopUpPool ?? true);
    setCsuiteSeedTopUpTarget(snap.csuiteSeedTopUpTarget ?? 15);
    setShowHistory(false);
    setTimeout(() => { restoringRef.current = false; }, 0);
  };

  // Écoute les 30 derniers snapshots d'historique
  useEffect(() => {
    if (!firebaseEnabled) return;
    const q = query(collection(db, "captable_history"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Sauvegarde automatique (débounce 2.5s) à chaque changement significatif
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (restoringRef.current) return;
    const snap = snapshotState();
    const serialized = JSON.stringify(snap);
    if (serialized === lastSavedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await authReady;
        await addDoc(collection(db, "captable_history"), { data: snap, createdAt: serverTimestamp() });
        lastSavedRef.current = serialized;
      } catch (err) {
        console.error("Sauvegarde historique échouée", err);
      }
    }, 2500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, founders, weights, esopPool, cliffMonths, vestMonths, raiseAmount, preMoney, topUpPool, topUpTarget, csuite, csuiteWeights, csuiteEsop, csuiteSeedRaise, csuiteSeedCap, csuiteSeedTopUpPool, csuiteSeedTopUpTarget]);

  const formatHistoryDate = (ts) => {
    if (!ts?.toDate) return "…";
    return ts.toDate().toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-screen bg-[#0D0D0D] text-[#F2F2ED] pb-24">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap');
        .disp { font-family: 'Barlow Condensed', sans-serif; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; background: #2A2A2A; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--thumb, #CCFF00); cursor: pointer; border: 2px solid #0D0D0D; box-shadow: 0 0 0 1px rgba(255,255,255,0.15); }
        .scrollbar-thin::-webkit-scrollbar { height: 4px; width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div className="border-b border-[#232323] px-5 sm:px-8 pt-8 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="text-[11px] tracking-[0.25em] text-[#CCFF00] font-semibold mb-2">SPLIT ÉQUITABLE — OUTIL DE DÉCISION</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {firebaseEnabled && (
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="flex items-center gap-1.5 text-[12px] text-[#9A9A94] hover:text-[#CCFF00] border border-[#2A2A2A] hover:border-[#CCFF00] rounded-full px-3 py-1.5 transition-colors"
                >
                  <History size={12} /> Historique
                </button>
              )}
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 text-[12px] text-[#9A9A94] hover:text-[#CCFF00] border border-[#2A2A2A] hover:border-[#CCFF00] rounded-full px-3 py-1.5 transition-colors"
              >
                <RotateCcw size={12} /> Remise à zéro
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="mb-4 bg-[#151515] border border-[#232323] rounded-2xl p-4 max-h-72 overflow-y-auto scrollbar-thin">
              <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-2">
                HISTORIQUE — {history.length} version{history.length > 1 ? "s" : ""} sauvegardée{history.length > 1 ? "s" : ""} automatiquement
              </div>
              {history.length === 0 && (
                <p className="text-[12px] text-[#6B6B66]">Aucune version enregistrée pour l'instant — les changements se sauvegardent automatiquement quelques secondes après chaque modification.</p>
              )}
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 text-[12.5px] py-1.5 border-b border-[#232323] last:border-0">
                    <span className="text-[#B5B5AF]">{formatHistoryDate(h.createdAt)}</span>
                    <button
                      onClick={() => restoreSnapshot(h.data)}
                      className="text-[11px] text-[#CCFF00] hover:underline flex-shrink-0"
                    >
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h1 className="disp italic font-black text-[40px] sm:text-[56px] leading-[0.92] tracking-tight">
            Equity Split<br />Studio
          </h1>
          <p className="text-[#9A9A94] text-sm mt-3 max-w-xl leading-relaxed">
            Basé sur la méthodologie Carta pour cofondateurs&nbsp;: apport initial, engagement, risque et compétences critiques &mdash; pondérés, pas divisés à parts égales par défaut.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
        {/* LEFT: Builder */}
        <div className="space-y-6">
          {/* Method selector */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">MÉTHODE</span>
              <button onClick={() => setShowMethodInfo((s) => !s)} className="text-[#6B6B66] hover:text-[#CCFF00] transition-colors">
                <Info size={13} />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "value", label: "Basée sur la contribution" },
                { id: "flat", label: "Égalitaire (flat)" },
                { id: "market", label: "Basée sur le marché" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`px-4 py-2 text-[13px] font-medium rounded-full border transition-all ${
                    method === m.id
                      ? "bg-[#CCFF00] text-[#0D0D0D] border-[#CCFF00]"
                      : "border-[#333] text-[#B5B5AF] hover:border-[#555]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {showMethodInfo && (
              <div className="mt-3 text-[12.5px] text-[#9A9A94] leading-relaxed bg-[#151515] border border-[#232323] rounded-xl p-4">
                <b className="text-[#F2F2ED]">Contribution</b> pondère 6 facteurs (idée, temps, risque, exécution, capital, réseau) selon les poids ci-dessous. <b className="text-[#F2F2ED]">Égalitaire</b> divise le reste à parts égales, rarement justifié entre rôles différents. <b className="text-[#F2F2ED]">Marché</b> compare au salaire qu'il faudrait payer pour recruter chaque rôle à l'externe.
              </div>
            )}
          </div>

          {/* Weights, only for value method */}
          {method === "value" && (
            <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">POIDS DES FACTEURS</span>
                <span className={`text-[11px] font-mono ${weightTotal === 100 ? "text-[#7ED957]" : "text-[#FF6B6B]"}`}>
                  {weightTotal}% / 100%
                </span>
              </div>
              <button
                onClick={() => setWeights(SALARY_WEIGHTS)}
                className="mb-4 w-full text-left text-[12px] text-[#B5B5AF] hover:text-[#CCFF00] bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#CCFF00] rounded-lg px-3 py-2 transition-colors"
              >
                💡 Tous reçoivent un salaire → réduire le poids du risque et du temps
              </button>
              <div className="space-y-3">
                {FACTORS.map((fac) => (
                  <div key={fac.key}>
                    <div className="flex justify-between text-[12.5px] mb-1">
                      <span className="text-[#D5D5D0]">{fac.label}</span>
                      <span className="text-[#6B6B66] font-mono">{weights[fac.key]}%</span>
                    </div>
                    <input
                      type="range" min={0} max={40} value={weights[fac.key]}
                      style={{ "--thumb": "#CCFF00", width: "100%" }}
                      onChange={(e) => setWeights((w) => ({ ...w, [fac.key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ESOP pool */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="flex justify-between text-[12.5px] mb-1">
              <span className="text-[#D5D5D0]">Réserve ESOP (futurs employés / advisors)</span>
              <span className="text-[#CCFF00] font-mono font-semibold">{esopPool}%</span>
            </div>
            <input type="range" min={0} max={25} value={esopPool} style={{ "--thumb": "#CCFF00", width: "100%" }}
              onChange={(e) => setEsopPool(Number(e.target.value))} />
            <p className="text-[11px] text-[#6B6B66] mt-2">Les investisseurs s'attendent typiquement à 10&ndash;20% réservé avant leur entrée au capital.</p>
          </div>

          {/* Founders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">FONDATEURS & CONTRIBUTEURS</span>
              <button onClick={addFounder} disabled={founders.length >= 6}
                className="flex items-center gap-1 text-[12px] text-[#CCFF00] disabled:text-[#444] font-medium">
                <Plus size={14} /> Ajouter
              </button>
            </div>

            {founders.map((f) => {
              const isOpen = expandedId === f.id;
              const r = results.find((x) => x.id === f.id);
              return (
                <div key={f.id} className="bg-[#151515] border border-[#232323] rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : f.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate">{f.name}</div>
                      <div className="text-[12px] text-[#8A8A85] truncate">{f.role}</div>
                    </div>
                    <div className="disp italic font-black text-[22px] text-[#F2F2ED]">{r.pct.toFixed(1)}%</div>
                    <ChevronDown size={16} className={`text-[#666] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 pt-1 border-t border-[#232323] space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">NOM</label>
                          <input value={f.name} onChange={(e) => updateFounder(f.id, { name: e.target.value })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                        </div>
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">RÔLE</label>
                          <input value={f.role} onChange={(e) => updateFounder(f.id, { role: e.target.value })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10.5px] text-[#6B6B66] tracking-wide">CLASSE D'ACTIONS</label>
                        <div className="flex gap-2 mt-1">
                          {["A", "B"].map((c) => (
                            <button key={c} onClick={() => updateFounder(f.id, { stockClass: c })}
                              className={`px-3 py-1 rounded-lg text-[12px] font-medium border ${
                                f.stockClass === c ? "bg-[#CCFF00] text-[#0D0D0D] border-[#CCFF00]" : "border-[#2A2A2A] text-[#9A9A94]"
                              }`}>
                              Classe {c}
                            </button>
                          ))}
                          <span className="text-[10.5px] text-[#6B6B66] self-center ml-1">A = super-vote (contrôle) · B = économique standard</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10.5px] text-[#6B6B66] tracking-wide">SALAIRE ANNUEL ACTUEL (CAD)</label>
                        <input type="number" value={f.salaireAnnuel} step={5000}
                          onChange={(e) => updateFounder(f.id, { salaireAnnuel: Number(e.target.value) })}
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                        <p className="text-[10.5px] text-[#6B6B66] mt-1">Si les deux touchent un salaire proche du marché, baisse le curseur "Risque assumé" pour les deux &mdash; le sacrifice financier réel est moindre.</p>
                      </div>

                      {method === "value" && (
                        <div className="space-y-2.5 pt-1">
                          {FACTORS.map((fac) => (
                            <div key={fac.key}>
                              <div className="flex justify-between text-[12px] mb-1">
                                <span className="text-[#B5B5AF]">{fac.label}</span>
                                <span className="text-[#6B6B66] font-mono">{f.factors[fac.key]}/10</span>
                              </div>
                              <input type="range" min={0} max={10} value={f.factors[fac.key]}
                                style={{ "--thumb": f.color, width: "100%" }}
                                onChange={(e) => updateFactor(f.id, fac.key, Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      )}

                      {method === "market" && (
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">SALAIRE MARCHÉ ANNUEL POUR CE RÔLE (CAD)</label>
                          <input type="number" value={f.marketSalary} step={5000}
                            onChange={(e) => updateFounder(f.id, { marketSalary: Number(e.target.value) })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                        </div>
                      )}

                      {founders.length > 1 && (
                        <button onClick={() => removeFounder(f.id)} className="flex items-center gap-1 text-[12px] text-[#FF6B6B] pt-1">
                          <Trash2 size={12} /> Retirer ce contributeur
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          {/* Ownership bar */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-3">RÉPARTITION SUGGÉRÉE</div>
            <div className="flex w-full h-8 rounded-lg overflow-hidden mb-3">
              {results.map((r) => (
                <div key={r.id} style={{ width: `${r.pct}%`, background: r.color }} title={`${r.name}: ${r.pct.toFixed(1)}%`} />
              ))}
              <div style={{ width: `${esopPool}%`, background: "#2A2A2A" }} />
            </div>
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                    <span className="truncate text-[#D5D5D0]">{r.name}</span>
                    <span className="text-[10.5px] text-[#666] flex-shrink-0">Classe {r.stockClass}</span>
                  </div>
                  <span className="font-mono text-[#F2F2ED] font-semibold flex-shrink-0">{r.pct.toFixed(1)}%</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-[13px] pt-1 border-t border-[#232323]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A]" />
                  <span className="text-[#8A8A85]">Pool ESOP (réserve)</span>
                </div>
                <span className="font-mono text-[#8A8A85]">{esopPool}%</span>
              </div>
            </div>
          </div>

          {/* Pie chart classes */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-2">MASSE PAR CLASSE D'ACTIONS</div>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={54} paddingAngle={2} stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0D0D0D", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-6"><span className="text-[#B5B5AF]">Classe A (contrôle)</span><span className="font-mono">{classA.toFixed(1)}%</span></div>
                <div className="flex justify-between gap-6"><span className="text-[#B5B5AF]">Classe B (économique)</span><span className="font-mono">{classB.toFixed(1)}%</span></div>
                <div className="flex justify-between gap-6"><span className="text-[#8A8A85]">Pool ESOP</span><span className="font-mono">{esopPool}%</span></div>
              </div>
            </div>
          </div>

          {/* Current vs suggested */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={13} className="text-[#CCFF00]" />
              <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">TON STRUCTURE ACTUELLE VS OUTIL</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[10.5px] text-[#666] mb-1">ACTUEL</div>
                <div className="text-[#D5D5D0]">Dominique &mdash; 100% Classe A</div>
                <div className="text-[#8A8A85]">10% Classe B promis</div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#666] mb-1">SUGGÉRÉ ({method === "value" ? "contribution" : method === "flat" ? "égalitaire" : "marché"})</div>
                {results.map((r) => (
                  <div key={r.id} className="text-[#D5D5D0] truncate">{r.name.split(" ")[0]} &mdash; {r.pct.toFixed(1)}% (Cl. {r.stockClass})</div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[#6B6B66] mt-3 leading-relaxed">
              Le 10% promis en Classe B se compare bien à ce que l'outil suggère si le rôle du deuxième contributeur reflète ses curseurs ci-dessus. Ajuste les facteurs pour tester si 10% est généreux, juste, ou insuffisant vu l'engagement réel.
            </p>
          </div>

          {/* Funding round simulation */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowFunding((s) => !s)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-[#CCFF00]" />
                <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">SIMULER UNE RONDE DE FINANCEMENT</span>
              </div>
              <ChevronDown size={16} className={`text-[#666] transition-transform ${showFunding ? "rotate-180" : ""}`} />
            </button>

            {showFunding && (
              <div className="px-5 pb-5 pt-0 space-y-4 border-t border-[#232323]">
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div>
                    <label className="text-[10.5px] text-[#6B6B66] tracking-wide">MONTANT LEVÉ (CAD)</label>
                    <input type="number" value={raiseAmount} step={25000}
                      onChange={(e) => setRaiseAmount(Number(e.target.value))}
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[#6B6B66] tracking-wide">VALORISATION PRÉ-MONEY (CAD)</label>
                    <input type="number" value={preMoney} step={100000}
                      onChange={(e) => setPreMoney(Number(e.target.value))}
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[12px] text-[#B5B5AF]">
                  <input type="checkbox" checked={topUpPool} onChange={(e) => setTopUpPool(e.target.checked)}
                    className="accent-[#CCFF00]" />
                  Recharger le pool ESOP à
                  <input type="number" value={topUpTarget} disabled={!topUpPool} step={1}
                    onChange={(e) => setTopUpTarget(Number(e.target.value))}
                    className="w-14 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[12px] disabled:opacity-40" />
                  % avant la ronde
                </label>
                <p className="text-[10.5px] text-[#6B6B66] -mt-2">Pratique courante demandée par les investisseurs &mdash; cette dilution vient seulement des fondateurs, pas d'eux.</p>

                <div className="bg-[#0D0D0D] border border-[#232323] rounded-xl p-4">
                  <div className="flex justify-between text-[12.5px] mb-3">
                    <span className="text-[#8A8A85]">Post-money</span>
                    <span className="font-mono text-[#F2F2ED]">{fundingResults.postMoney.toLocaleString("fr-CA")} $</span>
                  </div>
                  <div className="flex justify-between text-[12.5px] mb-3 pb-3 border-b border-[#232323]">
                    <span className="text-[#8A8A85]">Nouveaux investisseurs</span>
                    <span className="font-mono text-[#CCFF00] font-semibold">{fundingResults.investorPct.toFixed(1)}%</span>
                  </div>
                  <div className="space-y-2">
                    {fundingResults.founders.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                          <span className="truncate text-[#D5D5D0]">{f.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono text-[#F2F2ED] font-semibold">{f.postPct.toFixed(1)}%</span>
                          <span className="text-[10.5px] text-[#6B6B66] ml-1.5">(avant: {f.pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-[13px] pt-1 border-t border-[#232323]">
                      <span className="text-[#8A8A85]">Pool ESOP</span>
                      <span className="font-mono text-[#8A8A85]">{fundingResults.poolPost.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[#6B6B66] leading-relaxed">
                  Après cette ronde, chaque fondateur possède une part plus petite d'une compagnie qui vaut plus cher &mdash; c'est la dilution normale. Ce qui compte, c'est la valeur en dollars, pas le pourcentage brut.
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-3">VESTING</div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="flex justify-between text-[12px] mb-1"><span className="text-[#B5B5AF]">Cliff</span><span className="font-mono text-[#666]">{cliffMonths} mois</span></div>
                <input type="range" min={0} max={24} value={cliffMonths} style={{ "--thumb": "#CCFF00", width: "100%" }} onChange={(e) => setCliffMonths(Number(e.target.value))} />
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1"><span className="text-[#B5B5AF]">Durée totale</span><span className="font-mono text-[#666]">{vestMonths} mois</span></div>
                <input type="range" min={24} max={60} value={vestMonths} style={{ "--thumb": "#CCFF00", width: "100%" }} onChange={(e) => setVestMonths(Number(e.target.value))} />
              </div>
            </div>
            <div className="relative h-2 bg-[#232323] rounded-full overflow-hidden">
              <div className="absolute h-full bg-[#3A3A3A]" style={{ width: `${(cliffMonths / vestMonths) * 100}%` }} />
              <div className="absolute h-full bg-[#CCFF00]" style={{ left: `${(cliffMonths / vestMonths) * 100}%`, width: `${100 - (cliffMonths / vestMonths) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10.5px] text-[#666] mt-1.5">
              <span>Mois 0</span><span>Cliff: {cliffMonths}m &mdash; 0% avant, {(100/vestMonths*cliffMonths).toFixed(0)}% débloqué au cliff</span><span>{vestMonths}m: 100%</span>
            </div>
            <p className="text-[11px] text-[#6B6B66] mt-3 leading-relaxed">
              Standard marché&nbsp;: 4 ans, cliff de 12 mois. Même les fondateurs vestent &mdash; ça protège l'équipe restante si quelqu'un part tôt, et c'est ce que les investisseurs vérifient en premier.
            </p>
          </div>

          {/* Investor checklist */}
          <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={13} className="text-[#CCFF00]" />
              <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">PRÊT POUR LES INVESTISSEURS</span>
            </div>
            <ul className="space-y-2 text-[12.5px] text-[#B5B5AF]">
              {[
                "Vesting 4 ans / cliff 1 an signé par tous, y compris toi",
                "Pool ESOP de 10\u201320% réservé avant le tour de financement",
                "Rôles et droits de décision écrits noir sur blanc",
                "Accord de cession de PI signé par chaque contributeur",
                "Rationale du dual-class (A/B) documentée pour les investisseurs",
                "Split revisité seulement à des jalons clairs, pas à volonté",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[#CCFF00] flex-shrink-0">&#10003;</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* C-SUITE SECTION                                                */}
      {/* ============================================================ */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-16">
        <div className="border-t border-[#232323] pt-10">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-[#CCFF00]" />
            <span className="text-[11px] tracking-[0.25em] text-[#CCFF00] font-semibold">STRUCTURE DE DIRECTION</span>
          </div>
          <h2 className="disp italic font-black text-[32px] sm:text-[42px] leading-[0.95] tracking-tight mb-3">
            Rôles C-suite<br />& part équitable
          </h2>
          <p className="text-[#9A9A94] text-sm max-w-2xl leading-relaxed mb-8">
            Les six rôles de direction attendus pour PürInstinct / Games / INSTINCT. Inscris un nom pour chaque poste, ajuste son implication (temps plein ou partiel), puis compare la part suggérée selon la contribution individuelle ou selon le poids de chaque catégorie de facteur.
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setCsuiteTab("individual")}
              className={`px-4 py-2 text-[13px] font-medium rounded-full border transition-all ${
                csuiteTab === "individual"
                  ? "bg-[#CCFF00] text-[#0D0D0D] border-[#CCFF00]"
                  : "border-[#333] text-[#B5B5AF] hover:border-[#555]"
              }`}
            >
              Apport individuel par critère
            </button>
            <button
              onClick={() => setCsuiteTab("category")}
              className={`px-4 py-2 text-[13px] font-medium rounded-full border transition-all ${
                csuiteTab === "category"
                  ? "bg-[#CCFF00] text-[#0D0D0D] border-[#CCFF00]"
                  : "border-[#333] text-[#B5B5AF] hover:border-[#555]"
              }`}
            >
              Poids par catégorie
            </button>
          </div>

          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
            {/* LEFT: role cards */}
            <div className="space-y-6">
              {csuiteTab === "category" && (
                <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">POIDS DES CATÉGORIES (s'applique à tous les rôles)</span>
                    <span className={`text-[11px] font-mono ${csuiteWeightTotal === 100 ? "text-[#7ED957]" : "text-[#FF6B6B]"}`}>
                      {csuiteWeightTotal}% / 100%
                    </span>
                  </div>
                  <div className="space-y-3">
                    {FACTORS.map((fac) => (
                      <div key={fac.key}>
                        <div className="flex justify-between text-[12.5px] mb-1">
                          <span className="text-[#D5D5D0]">{fac.label}</span>
                          <span className="text-[#6B6B66] font-mono">{csuiteWeights[fac.key]}%</span>
                        </div>
                        <input
                          type="range" min={0} max={40} value={csuiteWeights[fac.key]}
                          style={{ "--thumb": "#CCFF00", width: "100%" }}
                          onChange={(e) => setCsuiteWeights((w) => ({ ...w, [fac.key]: Number(e.target.value) }))}
                        />
                        <p className="text-[10.5px] text-[#6B6B66] mt-1">{fac.hint}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#6B6B66] mt-4 leading-relaxed">
                    Ces poids déterminent l'importance relative de chaque type de contribution à travers tous les rôles. Change ensuite les curseurs individuels de chaque poste dans l'onglet "Apport individuel" pour voir la part se recalculer.
                  </p>
                </div>
              )}

              <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span className="text-[#D5D5D0]">Réserve ESOP (futurs employés / advisors)</span>
                  <span className="text-[#CCFF00] font-mono font-semibold">{csuiteEsop}%</span>
                </div>
                <input type="range" min={0} max={25} value={csuiteEsop} style={{ "--thumb": "#CCFF00", width: "100%" }}
                  onChange={(e) => setCsuiteEsop(Number(e.target.value))} />
              </div>

              <div className="space-y-3">
                <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">LES 6 RÔLES</span>
                {csuiteResults.map((r) => (
                  <div key={r.key} className="bg-[#151515] border border-[#232323] rounded-2xl overflow-hidden">
                    <div className="p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${r.color}` }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[14px] font-semibold">{r.title}</div>
                          {r.pct < 10 && (
                            <span className="text-[9.5px] tracking-wide uppercase text-[#0D0D0D] bg-[#CCFF00] rounded-full px-2 py-0.5 font-semibold flex-shrink-0">
                              Premier employé
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8A8A85]">{r.scope} &middot; {r.fte}</div>
                      </div>
                      <div className="disp italic font-black text-[22px] text-[#F2F2ED]">{r.pct.toFixed(1)}%</div>
                    </div>

                    <div className="px-4 pb-5 pt-1 border-t border-[#232323] space-y-4">
                      <p className="text-[12.5px] text-[#B5B5AF] leading-relaxed">{r.desc}</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">NOM PRESSENTI</label>
                          <input
                            value={csuite[r.key].name}
                            placeholder="Écrire un nom…"
                            onChange={(e) => updateCsuiteField(r.key, { name: e.target.value })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]"
                          />
                        </div>
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">IMPLICATION (% temps plein)</label>
                          <input
                            type="number" min={0} max={100} step={5}
                            value={csuite[r.key].fteShare}
                            onChange={(e) => updateCsuiteField(r.key, { fteShare: clamp(Number(e.target.value), 0, 100) })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]"
                          />
                        </div>
                      </div>
                      <p className="text-[10.5px] text-[#6B6B66] -mt-2">
                        Ex.: un CFO fractionnaire à 1 jour/semaine &asymp; 20%. Ça réduit sa part sans changer ses curseurs de contribution ci-dessous.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">CLIFF (MOIS)</label>
                          <input
                            type="number" min={0} max={24} step={1}
                            value={csuite[r.key].cliffMonths}
                            onChange={(e) => updateCsuiteField(r.key, { cliffMonths: clamp(Number(e.target.value), 0, 24) })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]"
                          />
                        </div>
                        <div>
                          <label className="text-[10.5px] text-[#6B6B66] tracking-wide">VESTING TOTAL (MOIS)</label>
                          <input
                            type="number" min={12} max={60} step={1}
                            value={csuite[r.key].vestMonths}
                            onChange={(e) => updateCsuiteField(r.key, { vestMonths: clamp(Number(e.target.value), 12, 60) })}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="relative h-1.5 bg-[#232323] rounded-full overflow-hidden">
                          <div className="absolute h-full bg-[#3A3A3A]" style={{ width: `${(csuite[r.key].cliffMonths / csuite[r.key].vestMonths) * 100}%` }} />
                          <div className="absolute h-full" style={{ background: r.color, left: `${(csuite[r.key].cliffMonths / csuite[r.key].vestMonths) * 100}%`, width: `${100 - (csuite[r.key].cliffMonths / csuite[r.key].vestMonths) * 100}%` }} />
                        </div>
                        <p className="text-[10.5px] text-[#6B6B66] mt-1.5">
                          Avant le mois {csuite[r.key].cliffMonths}&nbsp;: 0% acquis. Au cliff&nbsp;: {(100 / csuite[r.key].vestMonths * csuite[r.key].cliffMonths).toFixed(0)}% débloqué d'un coup. 100% acquis au mois {csuite[r.key].vestMonths}.
                        </p>
                      </div>

                      {csuiteTab === "individual" && (
                        <div className="space-y-2.5 pt-1">
                          {FACTORS.map((fac) => (
                            <div key={fac.key}>
                              <div className="flex justify-between text-[12px] mb-1">
                                <span className="text-[#B5B5AF]">{fac.label}</span>
                                <span className="text-[#6B6B66] font-mono">{csuite[r.key].factors[fac.key]}/10</span>
                              </div>
                              <input type="range" min={0} max={10} value={csuite[r.key].factors[fac.key]}
                                style={{ "--thumb": r.color, width: "100%" }}
                                onChange={(e) => updateCsuiteFactor(r.key, fac.key, Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: C-suite results */}
            <div className="space-y-6 lg:sticky lg:top-6 self-start">
              <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
                <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-3">RÉPARTITION SUGGÉRÉE — ÉQUIPE DE DIRECTION</div>
                <div className="flex w-full h-8 rounded-lg overflow-hidden mb-3">
                  {csuiteResults.map((r) => (
                    <div key={r.key} style={{ width: `${r.pct}%`, background: r.color }} title={`${r.title}: ${r.pct.toFixed(1)}%`} />
                  ))}
                  <div style={{ width: `${csuiteEsop}%`, background: "#2A2A2A" }} />
                </div>
                <div className="space-y-2">
                  {csuiteResults.map((r) => (
                    <div key={r.key} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                        <div className="truncate">
                          <span className="text-[#D5D5D0]">{r.title}</span>
                          {r.name && <span className="text-[#8A8A85]"> &mdash; {r.name}</span>}
                          {r.pct < 10 && (
                            <span className="ml-1.5 text-[9px] tracking-wide uppercase text-[#0D0D0D] bg-[#CCFF00] rounded-full px-1.5 py-0.5 font-semibold">
                              Premier employé
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[#F2F2ED] font-semibold flex-shrink-0">{r.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[13px] pt-1 border-t border-[#232323]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A]" />
                      <span className="text-[#8A8A85]">Pool ESOP (réserve)</span>
                    </div>
                    <span className="font-mono text-[#8A8A85]">{csuiteEsop}%</span>
                  </div>
                </div>
              </div>

              {/* Seed Round simulation (SAFE, valuation cap) */}
              <div className="bg-[#151515] border border-[#232323] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowCsuiteSeed((s) => !s)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={13} className="text-[#CCFF00]" />
                    <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">SIMULER UN SEED ROUND (SAFE)</span>
                  </div>
                  <ChevronDown size={16} className={`text-[#666] transition-transform ${showCsuiteSeed ? "rotate-180" : ""}`} />
                </button>

                {showCsuiteSeed && (
                  <div className="px-5 pb-5 pt-0 space-y-4 border-t border-[#232323]">
                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <div>
                        <label className="text-[10.5px] text-[#6B6B66] tracking-wide">MONTANT LEVÉ (CAD)</label>
                        <input type="number" value={csuiteSeedRaise} step={25000}
                          onChange={(e) => setCsuiteSeedRaise(Number(e.target.value))}
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-[#6B6B66] tracking-wide">VALUATION CAP (CAD, post-money)</label>
                        <input type="number" value={csuiteSeedCap} step={100000}
                          onChange={(e) => setCsuiteSeedCap(Number(e.target.value))}
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[13px] mt-1 focus:outline-none focus:border-[#CCFF00]" />
                      </div>
                    </div>
                    <p className="text-[10.5px] text-[#6B6B66] -mt-2">Le cap détermine la valorisation maximale à laquelle les investisseurs SAFE convertissent, peu importe la valorisation de la prochaine ronde priced. Différents caps ou différents montants levés donnent des scénarios de dilution différents à tester ici.</p>

                    <label className="flex items-center gap-2 text-[12px] text-[#B5B5AF]">
                      <input type="checkbox" checked={csuiteSeedTopUpPool} onChange={(e) => setCsuiteSeedTopUpPool(e.target.checked)}
                        className="accent-[#CCFF00]" />
                      Recharger le pool ESOP à
                      <input type="number" value={csuiteSeedTopUpTarget} disabled={!csuiteSeedTopUpPool} step={1}
                        onChange={(e) => setCsuiteSeedTopUpTarget(Number(e.target.value))}
                        className="w-14 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2 py-1 text-[12px] disabled:opacity-40" />
                      % avant la ronde
                    </label>

                    <div className="bg-[#0D0D0D] border border-[#232323] rounded-xl p-4">
                      <div className="flex justify-between text-[12.5px] mb-3">
                        <span className="text-[#8A8A85]">Valorisation post-money (cap)</span>
                        <span className="font-mono text-[#F2F2ED]">{csuiteSeedResults.postMoney.toLocaleString("fr-CA")} $</span>
                      </div>
                      <div className="flex justify-between text-[12.5px] mb-3 pb-3 border-b border-[#232323]">
                        <span className="text-[#8A8A85]">Investisseurs Seed (SAFE)</span>
                        <span className="font-mono text-[#CCFF00] font-semibold">{csuiteSeedResults.investorPct.toFixed(1)}%</span>
                      </div>
                      <div className="space-y-2">
                        {csuiteSeedResults.roles.map((r) => (
                          <div key={r.key} className="flex items-center justify-between text-[13px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                              <span className="truncate text-[#D5D5D0]">{r.title}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-mono text-[#F2F2ED] font-semibold">{r.postPct.toFixed(1)}%</span>
                              <span className="text-[10.5px] text-[#6B6B66] ml-1.5">(avant: {r.pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between text-[13px] pt-1 border-t border-[#232323]">
                          <span className="text-[#8A8A85]">Pool ESOP</span>
                          <span className="font-mono text-[#8A8A85]">{csuiteSeedResults.poolPost.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#6B6B66] leading-relaxed">
                      Le SAFE convertit au cap au prochain tour priced &mdash; la dilution ici vient uniquement de l'équipe de direction, pas des investisseurs déjà en place. Compare différents montants et différents caps pour voir l'impact sur chaque rôle.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
                <div className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold mb-2">VUE D'ENSEMBLE</div>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={csuitePieData} dataKey="value" innerRadius={32} outerRadius={54} paddingAngle={2} stroke="none">
                          {csuitePieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#0D0D0D", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 text-[12.5px]">
                    {csuiteResults.map((r) => (
                      <div key={r.key} className="flex justify-between gap-6">
                        <span className="text-[#B5B5AF] truncate">{r.title}</span>
                        <span className="font-mono flex-shrink-0">{r.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#151515] border border-[#232323] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={13} className="text-[#CCFF00]" />
                  <span className="text-[11px] tracking-[0.2em] text-[#9A9A94] font-semibold">LECTURE</span>
                </div>
                <p className="text-[12.5px] text-[#B5B5AF] leading-relaxed">
                  Cette section vise à démontrer l'apport réel de chaque rôle de direction, pas seulement le titre. Un CFO fractionnaire à 20% de temps reçoit mécaniquement une part plus petite qu'un COO à temps plein avec la même contribution par critère &mdash; c'est reflété dans le champ "Implication".
                </p>
                <p className="text-[12.5px] text-[#B5B5AF] leading-relaxed mt-2">
                  L'onglet <b className="text-[#F2F2ED]">Apport individuel</b> ajuste les curseurs de chaque personne séparément. L'onglet <b className="text-[#F2F2ED]">Poids par catégorie</b> change l'importance relative des 6 facteurs pour tout le monde à la fois &mdash; utile pour tester "et si le réseau comptait plus que l'exécution?" sans reconfigurer chaque rôle un par un.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
