import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, RotateCcw, Users, History, ArrowRightLeft, Copy, X, Clock, AlertTriangle, Sparkles, Info } from "lucide-react";
import { db, authReady, firebaseEnabled } from "./firebase";
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";

const SESSION_GAP_MS = 30 * 60 * 1000; // au-delà de 30 min d'inactivité, on démarre une nouvelle session d'historique

const ROLE_COLORS = ["#CCFF00", "#7C9EFF", "#FF6B6B", "#4FD1C5", "#F5A623", "#C792EA"];

const FACTORS = [
  { key: "idea", label: "Idée / IP d'origine", hint: "Qui a créé le concept ou l'actif initial" },
  { key: "time", label: "Engagement temps plein", hint: "% du temps consacré à l'entreprise" },
  { key: "risk", label: "Risque assumé", hint: "Salaire sacrifié, capital personnel investi" },
  { key: "execution", label: "Compétences critiques", hint: "Construit / opère le cœur du produit" },
  { key: "capital", label: "Capital apporté", hint: "Argent injecté dans l'entreprise" },
  { key: "network", label: "Réseau / actifs", hint: "Clients, distribution, relations stratégiques" },
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

const roleColor = (i) => ROLE_COLORS[i % ROLE_COLORS.length];

// 10 responsabilités essentielles par défaut, par rôle — éditables dans l'interface
const DEFAULT_RESPONSIBILITIES = {
  ceo: [
    "Vision produit et direction stratégique de PürInstinct / Games / INSTINCT",
    "Arbitrage final sur les décisions de capital et de levée de fonds",
    "Recrutement et rétention de l'équipe de direction",
    "Relations avec les investisseurs et le conseil d'administration",
    "Partenariats stratégiques structurants (marques, ligues, diffuseurs)",
    "Positionnement global de la marque face au marché",
    "Décisions finales sur la gouvernance et la structure d'équité",
    "Porte-parole principal auprès des médias et du public",
    "Validation du calendrier annuel des priorités clés",
    "Culture d'entreprise et vision à long terme",
  ],
  coo: [
    "Développement d'affaires et prospection de nouveaux partenaires",
    "Présence dans les rencontres stratégiques avec le CEO",
    "Négociation de contrats commerciaux et de partenariats",
    "Structuration des opérations à l'échelle de l'entreprise",
    "Suivi des indicateurs de performance (KPI) inter-départements",
    "Coordination entre les équipes Games, INSTINCT et corporatif",
    "Développement de nouveaux marchés, villes ou territoires",
    "Relations avec les fournisseurs et partenaires stratégiques",
    "Optimisation des processus internes et scalabilité",
    "Support à la structuration de la prochaine ronde de financement",
  ],
  cfo: [
    "Modélisation financière et prévisions budgétaires",
    "Structuration des rondes de financement (SAFE, ronde priced)",
    "Reporting aux investisseurs et au conseil",
    "Gestion de la trésorerie et des flux de liquidités",
    "Conformité fiscale et réglementaire",
    "Mise en place des politiques de gouvernance interne",
    "Négociation avec les institutions financières",
    "Suivi de la rentabilité par ligne d'affaires (Games / INSTINCT)",
    "Structuration de la table de capitalisation et du vesting",
    "Audit interne et gestion des risques financiers",
  ],
  logistics: [
    "Calendrier et planification des événements",
    "Gestion de la billetterie et des inscriptions",
    "Approvisionnement et gestion du matériel",
    "Recrutement, formation et supervision des coachs sur site",
    "Coordination des bénévoles et du personnel terrain",
    "Sécurité et conformité sur les sites d'événements",
    "Relations avec les fournisseurs et lieux d'accueil",
    "Logistique de transport et d'hébergement des équipes",
    "Gestion des horaires et de l'animation le jour J",
    "Bilan post-événement et amélioration continue",
  ],
  creative: [
    "Langage visuel et direction artistique globale",
    "Expérience de marque sur les événements et le contenu",
    "Direction de la production vidéo et photo",
    "Supervision du design graphique (Games + INSTINCT)",
    "Cohérence visuelle entre les plateformes et supports",
    "Direction artistique des campagnes marketing",
    "Création de l'ambiance et de la scénographie événementielle",
    "Collaboration avec les créateurs de contenu externes",
    "Développement de nouveaux formats créatifs",
    "Gestion de la bibliothèque d'actifs de marque",
  ],
};

const defaultCsuiteState = () => {
  const st = {};
  CSUITE_ROLES.forEach((r, i) => {
    st[r.key] = {
      name: "",
      fteShare: 100, // % of full-time equivalent — lets you mark someone as 0.5 FTE etc.
      factors: { idea: 3, time: 6, risk: 3, execution: 6, capital: 1, network: 3 },
      color: roleColor(i),
      cliffMonths: 12,
      vestMonths: 48,
      responsibilities: (DEFAULT_RESPONSIBILITIES[r.key] || []).map((label, idx) => ({ id: `${r.key}-${idx}`, label })),
    };
  });
  return st;
};

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

// ---- ÉQUITÉ SUGGÉRÉE — calcul local, n'écrit jamais dans le state csuite ----
const EQUITY_WEIGHTS = { idea: 0.15, time: 0.20, risk: 0.20, execution: 0.25, capital: 0.10, network: 0.10 };

function computeSuggestedEquity(factors, fteShare) {
  const poidsBrut = FACTORS.reduce((sum, f) => sum + factors[f.key] * EQUITY_WEIGHTS[f.key], 0);
  const poidsAjuste = poidsBrut * (fteShare / 100);
  const scoreNormalise = poidsAjuste / 10;

  const low = clamp(scoreNormalise * 8, 0.25, 12);
  const high = clamp(scoreNormalise * 8 + 4, 1, 20);

  const sorted = [...FACTORS].sort((a, b) => factors[b.key] - factors[a.key]);
  const top = sorted.slice(0, 2);
  const bottom = sorted.slice(-2);

  const explanation =
    `Suggéré autour de ${low.toFixed(1)}–${high.toFixed(1)}% pour ce rôle. ` +
    `Porté principalement par « ${top[0].label} » et « ${top[1].label} » — ${top[0].hint.toLowerCase()}. ` +
    `Moins pondéré par « ${bottom[1].label} », ce qui reflète un apport relatif plus faible sur ce critère pour ce rôle.`;

  return { low, high, explanation, topFactors: top, bottomFactors: bottom };
}

export default function EquitySplitStudio() {
  // C-suite section state
  const [csuite, setCsuite] = useState(defaultCsuiteState);
  const [expandedCsuiteKey, setExpandedCsuiteKey] = useState(CSUITE_ROLES[0].key);
  const [equityPopoverKey, setEquityPopoverKey] = useState(null);
  const [respTarget, setRespTarget] = useState({});
  const [newRespText, setNewRespText] = useState({});

  // Historique (Firebase) — sessions de travail sauvegardées automatiquement
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [isFlushingSave, setIsFlushingSave] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("captable_session_id") : null));
  const restoringRef = useRef(false);
  const lastSavedRef = useRef(null);
  const saveTimerRef = useRef(null);
  const sessionIdRef = useRef(currentSessionId);
  const sessionLastEditRef = useRef(Number(typeof window !== "undefined" && localStorage.getItem("captable_session_last_edit")) || 0);

  const resetAll = () => {
    setCsuite(defaultCsuiteState());
    setExpandedCsuiteKey(CSUITE_ROLES[0].key);
  };

  const updateCsuiteFactor = (key, factorKey, value) =>
    setCsuite((c) => ({ ...c, [key]: { ...c[key], factors: { ...c[key].factors, [factorKey]: value } } }));

  const updateCsuiteField = (key, patch) =>
    setCsuite((c) => ({ ...c, [key]: { ...c[key], ...patch } }));

  const addResponsibility = (roleKey, label) => {
    if (!label.trim()) return;
    setCsuite((c) => ({
      ...c,
      [roleKey]: {
        ...c[roleKey],
        responsibilities: [...(c[roleKey].responsibilities || []), { id: `${roleKey}-${Date.now()}`, label: label.trim() }],
      },
    }));
  };

  const removeResponsibility = (roleKey, respId) => {
    setCsuite((c) => ({
      ...c,
      [roleKey]: { ...c[roleKey], responsibilities: (c[roleKey].responsibilities || []).filter((r) => r.id !== respId) },
    }));
  };

  const moveResponsibility = (fromKey, respId, toKey, mode) => {
    if (!toKey || toKey === fromKey) return;
    setCsuite((c) => {
      const resp = (c[fromKey].responsibilities || []).find((r) => r.id === respId);
      if (!resp) return c;
      const newItem = { id: `${toKey}-${Date.now()}`, label: resp.label };
      const next = { ...c };
      if (mode === "transfer") {
        next[fromKey] = { ...c[fromKey], responsibilities: c[fromKey].responsibilities.filter((r) => r.id !== respId) };
      }
      next[toKey] = { ...c[toKey], responsibilities: [...(c[toKey].responsibilities || []), newItem] };
      return next;
    });
  };

  const snapshotState = () => ({ csuite });

  const restoreSnapshot = async (snap) => {
    // Flush toute modification en attente de la session en cours AVANT de basculer,
    // pour garantir qu'aucun changement récent (< 2.5s) ne soit perdu.
    if (firebaseEnabled && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const pending = snapshotState();
      const serializedPending = JSON.stringify(pending);
      if (serializedPending !== lastSavedRef.current) {
        setIsFlushingSave(true);
        try {
          await authReady;
          const now = Date.now();
          if (sessionIdRef.current && now - sessionLastEditRef.current <= SESSION_GAP_MS) {
            await updateDoc(doc(db, "captable_history", sessionIdRef.current), {
              data: pending, updatedAt: serverTimestamp(), editCount: increment(1),
            });
          } else {
            const ref = await addDoc(collection(db, "captable_history"), {
              data: pending, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), editCount: 1,
            });
            sessionIdRef.current = ref.id;
          }
          lastSavedRef.current = serializedPending;
        } catch (err) {
          console.error("Flush avant restauration échoué", err);
        } finally {
          setIsFlushingSave(false);
        }
      }
    }

    restoringRef.current = true;
    setCsuite(snap.csuite);
    setShowHistory(false);
    setConfirmRestoreId(null);
    // Restaurer une ancienne version démarre une nouvelle session — on ne veut pas
    // écraser silencieusement la session historique qu'on vient de restaurer.
    sessionIdRef.current = null;
    sessionLastEditRef.current = 0;
    setCurrentSessionId(null);
    localStorage.removeItem("captable_session_id");
    localStorage.removeItem("captable_session_last_edit");
    setTimeout(() => { restoringRef.current = false; }, 0);
  };

  // Écoute les 30 dernières sessions d'historique
  useEffect(() => {
    if (!firebaseEnabled) return;
    const q = query(collection(db, "captable_history"), orderBy("updatedAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Sauvegarde automatique groupée par session de travail (30 min d'inactivité = nouvelle session)
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
        const now = Date.now();
        const isNewSession = !sessionIdRef.current || (now - sessionLastEditRef.current) > SESSION_GAP_MS;
        if (isNewSession) {
          const ref = await addDoc(collection(db, "captable_history"), {
            data: snap, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), editCount: 1,
          });
          sessionIdRef.current = ref.id;
          setCurrentSessionId(ref.id);
        } else {
          await updateDoc(doc(db, "captable_history", sessionIdRef.current), {
            data: snap, updatedAt: serverTimestamp(), editCount: increment(1),
          });
        }
        sessionLastEditRef.current = now;
        localStorage.setItem("captable_session_id", sessionIdRef.current);
        localStorage.setItem("captable_session_last_edit", String(now));
        lastSavedRef.current = serialized;
      } catch (err) {
        console.error("Sauvegarde historique échouée", err);
      }
    }, 2500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csuite]);

  // Fermer le tiroir d'historique avec Échap
  useEffect(() => {
    if (!showHistory) return;
    const onKey = (e) => { if (e.key === "Escape") { setShowHistory(false); setConfirmRestoreId(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHistory]);

  // Fermer le popover "Équité suggérée" au clic extérieur
  useEffect(() => {
    if (!equityPopoverKey) return;
    const onClick = (e) => {
      if (!e.target.closest?.("[data-equity-popover]")) setEquityPopoverKey(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [equityPopoverKey]);

  const formatTime = (ts) => (ts?.toDate ? ts.toDate().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "…");
  const formatDate = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString("fr-CA", { day: "numeric", month: "short" }) : "");

  const formatSessionRange = (h) => {
    if (!h.createdAt?.toDate || !h.updatedAt?.toDate) return "…";
    const start = h.createdAt.toDate();
    const end = h.updatedAt.toDate();
    const dateStr = formatDate(h.createdAt);
    if (Math.abs(end - start) < 60000) return `${dateStr} · ${formatTime(h.createdAt)}`;
    return `${dateStr} · ${formatTime(h.createdAt)} – ${formatTime(h.updatedAt)}`;
  };

  const formatRelative = (ts) => {
    if (!ts?.toDate) return "…";
    const diffMin = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    return `il y a ${Math.round(diffH / 24)} j`;
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
        @keyframes historyDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes historyScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .history-drawer, .history-scrim { animation: none !important; }
        }
      `}</style>

      {/* Tiroir d'historique */}
      {showHistory && (
        <>
          <div
            className="history-scrim fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            style={{ animation: "historyScrimIn 200ms ease-out" }}
            onClick={() => { setShowHistory(false); setConfirmRestoreId(null); }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Historique des sessions"
            className="history-drawer fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#111111] border-l border-[#232323] z-50 shadow-2xl flex flex-col"
            style={{ animation: "historyDrawerIn 260ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#232323] flex-shrink-0">
              <div>
                <div className="text-[11px] tracking-[0.2em] text-[#CCFF00] font-semibold flex items-center gap-1.5">
                  <History size={12} /> HISTORIQUE
                </div>
                <div className="text-[13px] text-[#9A9A94] mt-1">
                  {history.length} session{history.length !== 1 ? "s" : ""} sauvegardée{history.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => { setShowHistory(false); setConfirmRestoreId(null); }}
                aria-label="Fermer l'historique"
                className="text-[#8A8A85] hover:text-[#F2F2ED] p-2 -mr-2 rounded-full hover:bg-[#1D1D1D] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-2.5">
              {history.length === 0 && (
                <div className="text-center py-16 px-4">
                  <Clock size={26} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[13px] text-[#8A8A85]">Aucune session enregistrée pour l'instant.</p>
                  <p className="text-[11.5px] text-[#6B6B66] mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                    Chaque session de travail se sauvegarde automatiquement. Reviens ici après avoir fait des changements pour la retrouver.
                  </p>
                </div>
              )}

              {history.map((h) => {
                const isCurrent = h.id === currentSessionId;
                const pendingConfirm = confirmRestoreId === h.id;
                return (
                  <div
                    key={h.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isCurrent ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.05]" : "border-[#232323] bg-[#161616]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#F2F2ED]">{formatSessionRange(h)}</span>
                          {isCurrent && (
                            <span className="text-[9px] tracking-wide uppercase text-[#0D0D0D] bg-[#CCFF00] rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0">
                              En cours
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-[#8A8A85] mt-1">
                          {formatRelative(h.updatedAt)} &middot; {h.editCount || 1} modification{(h.editCount || 1) > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    {pendingConfirm ? (
                      <div className="mt-3 pt-3 border-t border-[#232323]">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle size={13} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
                          <span className="text-[11.5px] text-[#B5B5AF]">
                            La session en cours sera d'abord sauvegardée (zéro perte), puis remplacée à l'écran par cette session.
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setConfirmRestoreId(null)}
                            disabled={isFlushingSave}
                            className="text-[12px] text-[#9A9A94] hover:text-[#F2F2ED] px-3 py-1.5 rounded-full border border-[#2A2A2A] hover:border-[#444] transition-colors disabled:opacity-40"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => restoreSnapshot(h.data)}
                            disabled={isFlushingSave}
                            className="text-[12px] font-semibold text-[#0D0D0D] bg-[#CCFF00] hover:brightness-110 rounded-full px-3.5 py-1.5 transition-[filter] disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {isFlushingSave && (
                              <span className="w-3 h-3 border-2 border-[#0D0D0D]/30 border-t-[#0D0D0D] rounded-full animate-spin" />
                            )}
                            {isFlushingSave ? "Sauvegarde en cours…" : "Confirmer la restauration"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      !isCurrent && (
                        <button
                          onClick={() => setConfirmRestoreId(h.id)}
                          className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#CCFF00] hover:underline"
                        >
                          <RotateCcw size={11} /> Restaurer cette session
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="border-b border-[#232323] px-5 sm:px-8 pt-8 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] text-[#CCFF00] font-semibold mb-2">
              <Users size={12} /> STRUCTURE DE DIRECTION
            </div>
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

          <h1 className="disp italic font-black text-[40px] sm:text-[56px] leading-[0.92] tracking-tight">
            Rôles C-suite
          </h1>
          <p className="text-[#9A9A94] text-sm mt-3 max-w-xl leading-relaxed">
            Les six rôles de direction attendus pour PürInstinct / Games / INSTINCT. Inscris un nom pour chaque poste, ajuste son implication (temps plein ou partiel), son vesting, ses responsabilités et son apport individuel par critère.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* C-SUITE SECTION                                                */}
      {/* ============================================================ */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 mt-8">
        <div className="grid gap-5 md:grid-cols-2">
          {CSUITE_ROLES.map((r, i) => {
            const isOpen = expandedCsuiteKey === r.key;
            const color = csuite[r.key].color || roleColor(i);
            return (
              <div key={r.key} className="bg-[#151515] border border-[#232323] rounded-2xl overflow-hidden self-start">
                <button
                  onClick={() => setExpandedCsuiteKey(isOpen ? null : r.key)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">{r.title}</div>
                    <div className="text-[11px] text-[#8A8A85]">{r.scope} &middot; {r.fte}</div>
                  </div>
                  <ChevronDown size={16} className={`text-[#666] transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
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

                    <div className="relative" data-equity-popover>
                      <button
                        onClick={() => setEquityPopoverKey(equityPopoverKey === r.key ? null : r.key)}
                        className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#CCFF00] border border-[#CCFF00]/40 hover:border-[#CCFF00] rounded-full px-3 py-1.5 transition-colors"
                      >
                        <Sparkles size={12} /> Équité suggérée
                      </button>

                      {equityPopoverKey === r.key && (() => {
                        const result = computeSuggestedEquity(csuite[r.key].factors, csuite[r.key].fteShare);
                        return (
                          <div className="absolute z-30 mt-2 w-[280px] bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10.5px] tracking-[0.15em] text-[#CCFF00] font-semibold">FOURCHETTE SUGGÉRÉE</span>
                              <button onClick={() => setEquityPopoverKey(null)} className="text-[#6B6B66] hover:text-[#F2F2ED]">
                                <X size={13} />
                              </button>
                            </div>
                            <div className="disp italic font-black text-[28px] leading-none mb-2" style={{ color: csuite[r.key].color }}>
                              {result.low.toFixed(1)}–{result.high.toFixed(1)}%
                            </div>
                            <p className="text-[11.5px] text-[#B5B5AF] leading-relaxed">{result.explanation}</p>
                            <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-[#232323]">
                              <Info size={11} className="text-[#6B6B66] flex-shrink-0 mt-0.5" />
                              <p className="text-[10px] text-[#6B6B66] leading-relaxed">
                                Indicatif seulement, basé sur tes curseurs d'apport et inspiré de méthodes reconnues
                                (Founder's Pie Calculator, Slicing Pie, The Founder's Dilemmas). N'écrit aucune valeur
                                ailleurs dans l'outil — à toi de décider.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <p className="text-[10.5px] text-[#6B6B66] -mt-2">
                      Ex.: un CFO fractionnaire à 1 jour/semaine &asymp; 20% de temps plein.
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
                        <div className="absolute h-full" style={{ background: color, left: `${(csuite[r.key].cliffMonths / csuite[r.key].vestMonths) * 100}%`, width: `${100 - (csuite[r.key].cliffMonths / csuite[r.key].vestMonths) * 100}%` }} />
                      </div>
                      <p className="text-[10.5px] text-[#6B6B66] mt-1.5">
                        Avant le mois {csuite[r.key].cliffMonths}&nbsp;: 0% acquis. Au cliff&nbsp;: {(100 / csuite[r.key].vestMonths * csuite[r.key].cliffMonths).toFixed(0)}% débloqué d'un coup. 100% acquis au mois {csuite[r.key].vestMonths}.
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <span className="text-[10.5px] text-[#6B6B66] tracking-wide">APPORT INDIVIDUEL PAR CRITÈRE</span>
                      {FACTORS.map((fac) => (
                        <div key={fac.key}>
                          <div className="flex justify-between text-[12px] mb-1">
                            <span className="text-[#B5B5AF]">{fac.label}</span>
                            <span className="text-[#6B6B66] font-mono">{csuite[r.key].factors[fac.key]}/10</span>
                          </div>
                          <input type="range" min={0} max={10} value={csuite[r.key].factors[fac.key]}
                            style={{ "--thumb": color, width: "100%" }}
                            onChange={(e) => updateCsuiteFactor(r.key, fac.key, Number(e.target.value))} />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#232323]">
                      <div className="flex items-center justify-between mb-2 pt-2">
                        <span className="text-[10.5px] text-[#6B6B66] tracking-wide">RESPONSABILITÉS ({(csuite[r.key].responsibilities || []).length})</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#6B6B66]">Vers</span>
                          <select
                            value={respTarget[r.key] || CSUITE_ROLES.find((x) => x.key !== r.key)?.key}
                            onChange={(e) => setRespTarget((t) => ({ ...t, [r.key]: e.target.value }))}
                            className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-1.5 py-1 text-[11px] text-[#B5B5AF] focus:outline-none focus:border-[#CCFF00]"
                          >
                            {CSUITE_ROLES.filter((x) => x.key !== r.key).map((x) => (
                              <option key={x.key} value={x.key}>{x.title}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {(csuite[r.key].responsibilities || []).map((resp) => (
                          <div key={resp.id} className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#232323] rounded-lg px-2.5 py-1.5">
                            <span className="flex-1 text-[12px] text-[#D5D5D0]">{resp.label}</span>
                            <button
                              onClick={() => moveResponsibility(r.key, resp.id, respTarget[r.key] || CSUITE_ROLES.find((x) => x.key !== r.key)?.key, "transfer")}
                              title="Transférer vers le rôle sélectionné"
                              className="text-[#6B6B66] hover:text-[#CCFF00] flex-shrink-0"
                            >
                              <ArrowRightLeft size={12} />
                            </button>
                            <button
                              onClick={() => moveResponsibility(r.key, resp.id, respTarget[r.key] || CSUITE_ROLES.find((x) => x.key !== r.key)?.key, "duplicate")}
                              title="Dupliquer vers le rôle sélectionné"
                              className="text-[#6B6B66] hover:text-[#CCFF00] flex-shrink-0"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              onClick={() => removeResponsibility(r.key, resp.id)}
                              title="Supprimer cette responsabilité"
                              className="text-[#6B6B66] hover:text-[#FF6B6B] flex-shrink-0"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-2">
                        <input
                          value={newRespText[r.key] || ""}
                          onChange={(e) => setNewRespText((t) => ({ ...t, [r.key]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              addResponsibility(r.key, newRespText[r.key] || "");
                              setNewRespText((t) => ({ ...t, [r.key]: "" }));
                            }
                          }}
                          placeholder="Ajouter une responsabilité…"
                          className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#CCFF00]"
                        />
                        <button
                          onClick={() => {
                            addResponsibility(r.key, newRespText[r.key] || "");
                            setNewRespText((t) => ({ ...t, [r.key]: "" }));
                          }}
                          className="flex items-center gap-1 text-[12px] text-[#CCFF00] px-2 flex-shrink-0"
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
