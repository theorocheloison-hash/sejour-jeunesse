'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  getPlanning,
  createPlanning,
  deletePlanning,
  getActivitesCatalogue,
  genererPlanningIA,
  getPlanningGenerationStatus,
  notifierPlanningEnseignant,
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  PlanningActivite,
  ActiviteCatalogue,
  GroupeSejour,
} from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import PlanningPDFButton from '@/src/components/pdf/PlanningPDFButton';

const COULEURS_ACTIVITE: { hex: string; label: string }[] = [
  { hex: '#16a34a', label: 'Vert' },
  { hex: '#2563eb', label: 'Bleu' },
  { hex: '#dc2626', label: 'Rouge' },
  { hex: '#d97706', label: 'Orange' },
  { hex: '#7c3aed', label: 'Violet' },
  { hex: '#0891b2', label: 'Cyan' },
  { hex: '#be185d', label: 'Rose' },
  { hex: '#374151', label: 'Gris' },
];

// ─── DroppableDay ────────────────────────────────────────────────────────────
function DroppableDay({
  dayIdx, dateStr, isHebergeur, slots, slotHeight, onCellClick, children
}: {
  dayIdx: number;
  dateStr: string;
  isHebergeur: boolean;
  slots: number;
  slotHeight: number;
  onCellClick: (slotIdx: number) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `day-${dateStr}` });
  return (
    <div ref={setNodeRef} className="flex-1 border-l border-gray-200 relative" style={{ minWidth: 120 }}>
      {Array.from({ length: slots }).map((_, slotIdx) => (
        <div
          key={slotIdx}
          style={{ height: `${slotHeight}px`, top: `${slotIdx * slotHeight}px` }}
          className={`absolute w-full border-b ${slotIdx % 2 === 0 ? 'border-gray-100' : 'border-gray-50'} ${isHebergeur ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}
          onClick={() => isHebergeur && onCellClick(slotIdx)}
        />
      ))}
      {children}
    </div>
  );
}

// ─── DraggableCatalogueItem ───────────────────────────────────────────────────
function DraggableCatalogueItem({ activite }: { activite: ActiviteCatalogue }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalogue-${activite.id}`,
    data: { type: 'catalogue', activite },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
      }}
      className="rounded-lg border border-[var(--color-accent)] bg-amber-50 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
      {...attributes}
      {...listeners}
    >
      <p className="text-xs font-semibold text-amber-800 truncate">{activite.nom}</p>
      {activite.description && (
        <p className="text-[10px] text-amber-600 truncate mt-0.5">{activite.description}</p>
      )}
    </div>
  );
}

// ─── DraggableActivity ───────────────────────────────────────────────────────
function DraggableActivity({
  act, topPx, heightPx, isHebergeur, colWidth, slotHeight, widthPct, leftPct, labelGroupes, onEdit, onResize
}: {
  act: PlanningActivite;
  topPx: number;
  heightPx: number;
  isHebergeur: boolean;
  colWidth: number;
  slotHeight: number;
  widthPct?: number;
  leftPct?: number;
  labelGroupes?: string;
  onEdit: () => void;
  onResize: (newDurationSlots: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: act.id,
    data: { colWidth },
    disabled: !isHebergeur,
  });

  const [resizing, setResizing] = React.useState(false);
  const justResized = React.useRef(false);
  const resizeStartY = React.useRef(0);
  const resizeStartHeight = React.useRef(0);
  const [currentHeight, setCurrentHeight] = React.useState(heightPx);

  React.useEffect(() => { setCurrentHeight(heightPx); }, [heightPx]);

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isHebergeur) return;
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = currentHeight;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - resizeStartY.current;
      const newH = Math.max(slotHeight, resizeStartHeight.current + delta);
      setCurrentHeight(newH);
    };
    const onUp = (ev: MouseEvent) => {
      const delta = ev.clientY - resizeStartY.current;
      const newH = Math.max(slotHeight, resizeStartHeight.current + delta);
      const newSlots = Math.round(newH / slotHeight);
      onResize(newSlots);
      setResizing(false);
      justResized.current = true;
      setTimeout(() => { justResized.current = false; }, 100);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${resizing ? currentHeight : heightPx}px`,
    left: `calc(${leftPct ?? 0}% + 1px)`,
    width: `calc(${widthPct ?? 100}% - 2px)`,
    right: 'auto',
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.7 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    cursor: isHebergeur ? (isDragging ? 'grabbing' : 'grab') : 'default',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); if (!isDragging && !resizing && !justResized.current) onEdit(); }}
    >
      <div
        className="h-full rounded-md text-white text-xs p-1.5 overflow-hidden shadow-sm select-none"
        style={{ backgroundColor: act.couleur ?? '#16a34a' }}
        {...(isHebergeur ? { ...attributes, ...listeners } : {})}
      >
        <div className="font-semibold text-[11px] leading-tight break-words whitespace-normal line-clamp-3">{act.titre}</div>
        <div className="opacity-80 text-[10px]">{act.heureDebut} - {act.heureFin}</div>
        {act.estCollective && <div className="opacity-90 text-[10px] font-bold">👥 Tous</div>}
        {labelGroupes && <div className="opacity-90 text-[10px] font-medium truncate">{labelGroupes}</div>}
        {act.description && <div className="opacity-70 text-[10px] truncate">{act.description}</div>}
        {isHebergeur && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e); }}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize flex items-center justify-center"
            style={{ zIndex: 20 }}
          >
            <div className="w-6 h-0.5 bg-white opacity-50 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DroppableParking ────────────────────────────────────────────────────────
function DroppableParking({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'parking' });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-32 rounded-xl border-2 border-dashed transition-colors p-2 space-y-1.5 ${
        isOver ? 'border-[var(--color-primary)] bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      {children}
    </div>
  );
}

// ─── DraggableParkingItem ─────────────────────────────────────────────────────
function DraggableParkingItem({ act }: { act: PlanningActivite }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `parking-${act.id}`,
    data: { type: 'parking', act },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
        backgroundColor: act.couleur ?? '#16a34a',
      }}
      className="rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing select-none text-white text-xs shadow-sm"
      {...attributes}
      {...listeners}
    >
      <p className="font-semibold text-[11px] leading-tight break-words">{act.titre}</p>
      <p className="opacity-80 text-[10px]">{act.heureDebut} - {act.heureFin}</p>
    </div>
  );
}

// ─── TabPlanning ─────────────────────────────────────────────────────────────

export interface TabPlanningProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  user: User;
  groupes: GroupeSejour[];
  onError: (message: string) => void;
}

export default function TabPlanning({ sejourId, sejour, user, groupes, onError }: TabPlanningProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [planning, setPlanning] = useState<PlanningActivite[]>([]);
  const [parking, setParking] = useState<PlanningActivite[]>([]);
  const [activitesCatalogue, setActivitesCatalogue] = useState<ActiviteCatalogue[]>([]);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [showConfirmViderPlanning, setShowConfirmViderPlanning] = useState(false);
  const generationPollRef = useRef<NodeJS.Timeout | null>(null);
  const calendarBodyRef = useRef<HTMLDivElement>(null);
  const [planningDebutActivites, setPlanningDebutActivites] = useState('');
  const [planningFinActivites, setPlanningFinActivites] = useState('');
  const [planningNotifying, setPlanningNotifying] = useState(false);
  const [planningNotified, setPlanningNotified] = useState(false);
  const [planningVue, setPlanningVue] = useState<'semaine' | 'jour'>('semaine');
  const [planningJourSelectionne, setPlanningJourSelectionne] = useState<string>('');
  const [planModal, setPlanModal] = useState<{
    open: boolean;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description: string;
    responsable: string;
    couleur: string;
    estCollective?: boolean;
    editId?: string;
  } | null>(null);

  const loadPlanning = useCallback(async () => {
    if (!sejourId) return;
    try {
      const [plan, activites] = await Promise.all([
        getPlanning(sejourId),
        getActivitesCatalogue(sejourId).catch(() => []),
      ]);
      setPlanning(plan);
      setActivitesCatalogue(activites);
    } catch { /* ignore */ }
  }, [sejourId]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    return () => {
      if (generationPollRef.current) clearInterval(generationPollRef.current);
    };
  }, []);

  const handleAddPlanning = async () => {
    if (!planModal || !sejourId) return;
    try {
      if (planModal.editId) {
        await deletePlanning(sejourId, planModal.editId);
        setPlanning(prev => prev.filter(p => p.id !== planModal.editId));
      }
      const newItem = await createPlanning(sejourId, {
        date: planModal.date,
        heureDebut: planModal.heureDebut,
        heureFin: planModal.heureFin,
        titre: planModal.titre,
        description: planModal.description || undefined,
        responsable: planModal.responsable || undefined,
        couleur: planModal.couleur || undefined,
        estCollective: planModal.estCollective ?? false,
        estManuelle: true,
      });
      setPlanning(prev => [...prev, newItem]);
      setPlanModal(null);
    } catch (err) {
      console.error('Erreur création planning:', err);
    }
  };

  const handleDeletePlanning = async (planningId: string) => {
    if (!sejourId) return;
    try {
      await deletePlanning(sejourId, planningId);
      setPlanning((prev) => prev.filter((p) => p.id !== planningId));
    } catch (err) {
      console.error('[handleDeletePlanning]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      loadPlanning();
    }
  };

  const handleGenererPlanningIA = async () => {
    if (!sejourId) return;
    setGenerationStatus('pending');
    try {
      const { jobId } = await genererPlanningIA(sejourId, planningDebutActivites || undefined, planningFinActivites || undefined);
      setGenerationJobId(jobId);
      generationPollRef.current = setInterval(async () => {
        try {
          const statusData = await getPlanningGenerationStatus(sejourId, jobId);
          if (statusData.status === 'done') {
            clearInterval(generationPollRef.current!);
            generationPollRef.current = null;
            setGenerationStatus('done');
            setGenerationJobId(null);
            await loadPlanning();
          } else if (statusData.status === 'error') {
            clearInterval(generationPollRef.current!);
            generationPollRef.current = null;
            setGenerationStatus('error');
          }
        } catch {
          clearInterval(generationPollRef.current!);
          generationPollRef.current = null;
          setGenerationStatus('error');
        }
      }, 2000);
    } catch {
      setGenerationStatus('error');
    }
  };

  const isHebergeur = user?.role === 'HEBERGEUR';
  const HOUR_START = 7;
  const HOUR_END = 22;
  const SLOT_HEIGHT = 24;
  const SLOTS = (HOUR_END - HOUR_START) * 2;

  // Séjour « Dates à définir » : pas de planning possible sans dates.
  if (!sejour.dateDebut || !sejour.dateFin) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Les dates du séjour ne sont pas encore définies. Renseignez-les pour accéder au planning.
      </div>
    );
  }
  const sejourDateDebut = sejour.dateDebut;
  const sejourDateFin = sejour.dateFin;

  const days: Date[] = [];
  const start = new Date(sejourDateDebut);
  const end = new Date(sejourDateFin);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const jourEffectif = planningVue === 'jour'
    ? (planningJourSelectionne || (days[0]?.toISOString().split('T')[0] ?? ''))
    : null;
  const daysAffiches = planningVue === 'jour'
    ? days.filter(d => d.toISOString().split('T')[0] === jourEffectif)
    : days;

  const DAY_LABELS = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
  const today = new Date();

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h - HOUR_START) * 60 + m;
  };

  const minutesToTime = (mins: number) => {
    const totalMins = mins + HOUR_START * 60;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const handleCellClick = (date: Date, slotIndex: number) => {
    if (!isHebergeur) return;
    const h = Math.floor(slotIndex / 2) + HOUR_START;
    const m = slotIndex % 2 === 0 ? '00' : '30';
    const hEnd = slotIndex % 2 === 0 ? h : h + 1;
    const mEnd = slotIndex % 2 === 0 ? '30' : '00';
    const dateStr = date.toISOString().split('T')[0];
    setPlanModal({
      open: true,
      date: dateStr,
      heureDebut: `${String(h).padStart(2,'0')}:${m}`,
      heureFin: `${String(hEnd).padStart(2,'0')}:${mEnd}`,
      titre: '',
      description: '',
      responsable: '',
      couleur: '',
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!isHebergeur) return;

    const overDay = event.over?.id as string | undefined;

    // ── Drop vers le parking ──────────────────────────────────────────────
    if (overDay === 'parking') {
      const actId = event.active.id as string;
      // Peut venir du calendrier (id = uuid) ou du parking lui-même (id = parking-uuid)
      const realId = actId.startsWith('parking-') ? actId.replace('parking-', '') : actId;
      const act = planning.find(p => p.id === realId);
      if (!act || !sejourId) return;
      try {
        await deletePlanning(sejourId, realId);
        setPlanning(prev => prev.filter(p => p.id !== realId));
        setParking(prev => [...prev, { ...act, id: realId }]);
      } catch { /* ignore */ }
      return;
    }

    // ── Drop depuis le parking vers le calendrier ─────────────────────────
    if (event.active.data.current?.type === 'parking') {
      const act = event.active.data.current.act as PlanningActivite;
      if (!overDay || !overDay.startsWith('day-') || !sejourId) return;
      const dateStr = overDay.replace('day-', '');

      // Calculer l'heure à partir de la position Y du drop
      const activatorEvent = event.activatorEvent as PointerEvent;
      const calendarEl = calendarBodyRef.current;
      let heureDebut = act.heureDebut;
      let heureFin = act.heureFin;
      if (calendarEl && activatorEvent) {
        const dropY = activatorEvent.clientY + event.delta.y;
        const rect = calendarEl.getBoundingClientRect();
        const offsetInCol = dropY - rect.top + calendarEl.scrollTop;
        const slotIdx = Math.max(0, Math.floor(offsetInCol / SLOT_HEIGHT));
        const startMins = slotIdx * 30;
        const duration = (() => {
          const [h1, m1] = act.heureDebut.split(':').map(Number);
          const [h2, m2] = act.heureFin.split(':').map(Number);
          return (h2 * 60 + m2) - (h1 * 60 + m1);
        })();
        const totalStart = (HOUR_START * 60) + startMins;
        const totalEnd = totalStart + duration;
        const pad = (n: number) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
        heureDebut = pad(totalStart);
        heureFin = pad(totalEnd);
      }

      try {
        const newItem = await createPlanning(sejourId, {
          date: dateStr,
          heureDebut,
          heureFin,
          titre: act.titre,
          description: act.description,
          responsable: act.responsable,
          couleur: act.couleur ?? undefined,
          estManuelle: act.estManuelle ?? true,
        });
        setParking(prev => prev.filter(p => p.id !== act.id));
        setPlanning(prev => [...prev, newItem]);
      } catch { /* ignore */ }
      return;
    }

    // ── Drop depuis le catalogue d'activités ─────────────────────────────
    if (event.active.data.current?.type === 'catalogue') {
      const activite = event.active.data.current.activite as ActiviteCatalogue;
      if (!overDay || !overDay.startsWith('day-') || !sejourId) return;
      const dateStr = overDay.replace('day-', '');

      // Calculer l'heure à partir de la position Y du drop
      const activatorEvent = event.activatorEvent as PointerEvent;
      const calendarEl = calendarBodyRef.current;
      let heureDebut = '09:00';
      const dureeCatalogue = 60;
      if (calendarEl && activatorEvent) {
        const dropY = activatorEvent.clientY + event.delta.y;
        const rect = calendarEl.getBoundingClientRect();
        const offsetInCol = dropY - rect.top + calendarEl.scrollTop;
        const slotIdx = Math.max(0, Math.floor(offsetInCol / SLOT_HEIGHT));
        const startMins = slotIdx * 30;
        const totalStart = HOUR_START * 60 + startMins;
        heureDebut = String(Math.floor(totalStart / 60)).padStart(2, '0') + ':' + String(totalStart % 60).padStart(2, '0');
      }
      const [hh, mm] = heureDebut.split(':').map(Number);
      const endMins = hh * 60 + mm + dureeCatalogue;
      const heureFin = String(Math.floor(endMins / 60)).padStart(2, '0') + ':' + String(endMins % 60).padStart(2, '0');

      setPlanModal({
        open: true,
        date: dateStr,
        heureDebut,
        heureFin,
        titre: activite.nom,
        description: activite.description ?? '',
        responsable: '',
        couleur: '',
      });
      return;
    }

    // ── Drag d'une activité existante dans le calendrier ─────────────────
    const { active, delta } = event;
    const actId = active.id as string;
    const act = planning.find(p => p.id === actId);
    if (!act) return;

    const deltaSlots = Math.round(delta.y / SLOT_HEIGHT);
    const deltaDays = Math.round(delta.x / (active.data.current?.colWidth ?? 120));

    const startMins = timeToMinutes(act.heureDebut);
    const endMins = timeToMinutes(act.heureFin);
    const duration = endMins - startMins;

    let newStartMins = startMins + deltaSlots * 30;
    newStartMins = Math.max(0, Math.min(newStartMins, (HOUR_END - HOUR_START) * 60 - duration));

    const oldDate = new Date(act.date);
    oldDate.setDate(oldDate.getDate() + deltaDays);
    const sejourStart = new Date(sejourDateDebut);
    const sejourEnd = new Date(sejourDateFin);
    const newDate = oldDate < sejourStart ? sejourStart : oldDate > sejourEnd ? sejourEnd : oldDate;
    const newDateStr = newDate.toISOString().split('T')[0];

    const newHeureDebut = minutesToTime(newStartMins);
    const newHeureFin = minutesToTime(newStartMins + duration);

    setPlanning(prev => prev.map(p => p.id === actId ? {
      ...p,
      date: newDateStr + 'T00:00:00.000Z',
      heureDebut: newHeureDebut,
      heureFin: newHeureFin,
    } : p));

    try {
      if (!sejourId) return;
      await deletePlanning(sejourId, actId);
      const newItem = await createPlanning(sejourId, {
        date: newDateStr,
        heureDebut: newHeureDebut,
        heureFin: newHeureFin,
        titre: act.titre,
        description: act.description,
        responsable: act.responsable,
        couleur: act.couleur ?? undefined,
        estManuelle: act.estManuelle ?? true,
      });
      setPlanning(prev => prev.map(p => p.id === actId ? newItem : p));
    } catch {
      setPlanning(prev => prev.map(p => p.id === actId ? act : p));
    }
  };

  return (
    <>
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    {/* Sélecteur vue Semaine / Jour */}
    <div className="mb-3 flex items-center gap-2">
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
        <button
          onClick={() => setPlanningVue('semaine')}
          className={`px-3 py-1.5 transition-colors ${planningVue === 'semaine' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Semaine
        </button>
        <button
          onClick={() => setPlanningVue('jour')}
          className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${planningVue === 'jour' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Jour
        </button>
      </div>
      {planningVue === 'jour' && (
        <select
          value={planningJourSelectionne}
          onChange={e => setPlanningJourSelectionne(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          {days.map(day => {
            const dateStr = day.toISOString().split('T')[0];
            return (
              <option key={dateStr} value={dateStr}>
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </option>
            );
          })}
        </select>
      )}
    </div>
    {isHebergeur && (
      <div className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Début activités</label>
              <input
                type="datetime-local"
                value={planningDebutActivites}
                onChange={e => setPlanningDebutActivites(e.target.value)}
                min={sejour.dateDebut.split('T')[0]}
                max={sejour.dateFin.split('T')[0]}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Fin activités</label>
              <input
                type="datetime-local"
                value={planningFinActivites}
                onChange={e => setPlanningFinActivites(e.target.value)}
                min={sejour.dateDebut.split('T')[0]}
                max={sejour.dateFin.split('T')[0]}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <button
              onClick={() => setShowConfirmViderPlanning(true)}
              disabled={planning.length === 0}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🗑 Vider le planning
            </button>
            <button
              onClick={handleGenererPlanningIA}
              disabled={generationStatus === 'pending'}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {generationStatus === 'pending' ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Génération en cours...
                </>
              ) : (
                <>✨ Générer le planning IA</>
              )}
            </button>
            {generationStatus === 'done' && <span className="text-sm text-green-600 font-medium">✓ Planning généré</span>}
            {generationStatus === 'error' && <span className="text-sm text-red-500">Erreur lors de la génération</span>}
            {planning.length > 0 && (
              <PlanningPDFButton
                planningProps={{
                  titreSejour: sejour.titre,
                  dateDebut: sejour.dateDebut,
                  dateFin: sejour.dateFin,
                  nombreEleves: sejour.placesTotales,
                  centreName: sejour.hebergementSelectionne?.nom,
                  planning,
                  groupes: groupes.map(g => ({ id: g.id, nom: g.nom, couleur: g.couleur, taille: g.taille })),
                }}
                filename={`planning-${sejour.titre.replace(/\s+/g, '-').toLowerCase()}.pdf`}
              />
            )}
            {isHebergeur && (
              <button
                onClick={async () => {
                  if (!sejourId) return;
                  setPlanningNotifying(true);
                  try {
                    await notifierPlanningEnseignant(sejourId);
                    setPlanningNotified(true);
                    setTimeout(() => setPlanningNotified(false), 5000);
                  } catch { /* ignore */ }
                  finally { setPlanningNotifying(false); }
                }}
                disabled={planningNotifying}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {planningNotified ? '✓ Enseignant notifié' : planningNotifying ? 'Envoi...' : '📧 Notifier l\'enseignant'}
              </button>
            )}
          </div>
      </div>
    )}
    {!isHebergeur && planning.length > 0 && (
      <div className="mb-4">
        <PlanningPDFButton
          planningProps={{
            titreSejour: sejour.titre,
            dateDebut: sejour.dateDebut,
            dateFin: sejour.dateFin,
            nombreEleves: sejour.placesTotales,
            centreName: sejour.hebergementSelectionne?.nom,
            planning,
            groupes: groupes.map(g => ({ id: g.id, nom: g.nom, couleur: g.couleur, taille: g.taille })),
          }}
          filename={`planning-${sejour.titre.replace(/\s+/g, '-').toLowerCase()}.pdf`}
        />
      </div>
    )}
    <div className="flex gap-4 h-full">
    <div className="flex-1 min-w-0">
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {!isHebergeur && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 font-medium">
          Lecture seule — seul l&apos;hébergeur peut modifier le planning
        </div>
      )}

        <div className="overflow-x-auto">
          <div style={{ minWidth: `${56 + daysAffiches.length * (planningVue === 'jour' ? 600 : 120)}px` }}>

            {/* Header jours */}
            <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
              <div className="w-14 shrink-0" />
              {daysAffiches.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} className="flex-1 text-center py-2 border-l border-gray-200" style={{ minWidth: 120 }}>
                    <div className="text-xs font-medium text-gray-500">{DAY_LABELS[day.getDay()]}</div>
                    <div className={`text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Corps scrollable */}
            <div ref={calendarBodyRef} style={{ height: '600px', overflowY: 'auto' }}>
              <div className="flex relative" style={{ height: `${SLOTS * SLOT_HEIGHT}px` }}>

                {/* Colonne heures */}
                <div className="w-14 shrink-0 relative">
                  {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                    <div key={i}
                      style={{ top: `${i * 2 * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT * 2}px` }}
                      className="absolute w-full flex items-start justify-end pr-2 pt-0.5">
                      <span className="text-[10px] text-gray-400">{String(HOUR_START + i).padStart(2,'0')}:00</span>
                    </div>
                  ))}
                </div>

                {/* Colonnes jours */}
                {daysAffiches.map((day, dayIdx) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const dayActivities = planning.filter(p => p.date.startsWith(dateStr));
                  const colWidth = 120;

                  return (
                    <DroppableDay
                      key={dayIdx}
                      dayIdx={dayIdx}
                      dateStr={dateStr}
                      isHebergeur={isHebergeur}
                      slots={SLOTS}
                      slotHeight={SLOT_HEIGHT}
                      onCellClick={(slotIdx) => handleCellClick(day, slotIdx)}
                    >
                      {(() => {
                        const toMin = (t: string) => {
                          const [h, m] = t.split(':').map(Number);
                          return (h - HOUR_START) * 60 + m;
                        };

                        // Algo sweep line — un bloc par PlanningActivite, pas de fusion
                        type ActCol = { act: PlanningActivite; col: number; totalCols: number };
                        const result: ActCol[] = [];
                        const columns: PlanningActivite[][] = [];

                        const sorted = [...dayActivities].sort((a, b) => {
                          const timeDiff = toMin(a.heureDebut) - toMin(b.heureDebut);
                          if (timeDiff !== 0) return timeDiff;
                          const nomA = a.titre.includes(' — ') ? a.titre.split(' — ')[0] : a.titre;
                          const nomB = b.titre.includes(' — ') ? b.titre.split(' — ')[0] : b.titre;
                          return nomA.localeCompare(nomB);
                        });

                        for (const act of sorted) {
                          const start = toMin(act.heureDebut);
                          let placed = false;
                          for (let c = 0; c < columns.length; c++) {
                            const last = columns[c][columns[c].length - 1];
                            if (toMin(last.heureFin) <= start) {
                              columns[c].push(act);
                              result.push({ act, col: c, totalCols: 0 });
                              placed = true;
                              break;
                            }
                          }
                          if (!placed) {
                            columns.push([act]);
                            result.push({ act, col: columns.length - 1, totalCols: 0 });
                          }
                        }

                        for (const item of result) {
                          const start = toMin(item.act.heureDebut);
                          const end = toMin(item.act.heureFin);
                          const overlapping = result.filter(other => {
                            const oStart = toMin(other.act.heureDebut);
                            const oEnd = toMin(other.act.heureFin);
                            return oStart < end && oEnd > start;
                          });
                          item.totalCols = Math.max(...overlapping.map(o => o.col + 1));
                        }

                        return result.map(({ act, col, totalCols }) => {
                          const topMin = toMin(act.heureDebut);
                          const botMin = toMin(act.heureFin);
                          const duration = botMin - topMin;
                          if (duration <= 0 || topMin < 0) return null;
                          const topPx = (topMin / 30) * SLOT_HEIGHT;
                          const heightPx = Math.max((duration / 30) * SLOT_HEIGHT, SLOT_HEIGHT);
                          const widthPct = 100 / totalCols;
                          const leftPct = col * widthPct;

                          return (
                            <DraggableActivity
                              key={act.id}
                              act={act}
                              topPx={topPx}
                              heightPx={heightPx}
                              isHebergeur={isHebergeur}
                              colWidth={colWidth}
                              slotHeight={SLOT_HEIGHT}
                              widthPct={widthPct}
                              leftPct={leftPct}
                              onEdit={() => setPlanModal({
                                open: true,
                                date: act.date.split('T')[0],
                                heureDebut: act.heureDebut,
                                heureFin: act.heureFin,
                                titre: act.titre,
                                description: act.description ?? '',
                                responsable: act.responsable ?? '',
                                couleur: act.couleur ?? '',
                                editId: act.id,
                              })}
                              onResize={async (newDurationSlots) => {
                                if (!isHebergeur || !sejourId) return;
                                const startMins = toMin(act.heureDebut);
                                const newEndMins = startMins + newDurationSlots * 30;
                                if (newEndMins <= startMins) return;
                                const newHeureFin = minutesToTime(newEndMins);
                                setPlanning(prev => prev.map(p => p.id === act.id ? { ...p, heureFin: newHeureFin } : p));
                                try {
                                  await deletePlanning(sejourId, act.id);
                                  const newItem = await createPlanning(sejourId, {
                                    date: act.date.split('T')[0],
                                    heureDebut: act.heureDebut,
                                    heureFin: newHeureFin,
                                    titre: act.titre,
                                    description: act.description,
                                    responsable: act.responsable,
                                    couleur: act.couleur ?? undefined,
                                  });
                                  setPlanning(prev => prev.map(p => p.id === act.id ? newItem : p));
                                } catch {
                                  setPlanning(prev => prev.map(p => p.id === act.id ? act : p));
                                }
                              }}
                            />
                          );
                        });
                      })()}
                    </DroppableDay>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      {/* Modale planModal rendue en fin de composant */}
    </div>
    </div>

    {/* Panneau latéral activités catalogue — visible seulement pour HEBERGEUR */}
    {isHebergeur && (
      <div className="hidden md:block w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sticky top-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Activités proposées
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Glissez une activité sur le planning pour l&apos;ajouter
          </p>
          {activitesCatalogue.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Aucune activité dans le catalogue.<br />
              <span className="text-[10px]">Ajoutez des produits de type Activité dans votre catalogue.</span>
            </p>
          ) : (
            <div className="space-y-2">
              {activitesCatalogue.map(a => (
                <DraggableCatalogueItem key={a.id} activite={a} />
              ))}
            </div>
          )}
          {/* Zone parking */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <span>⏸</span> Parking
            </h4>
            <p className="text-[10px] text-gray-400 mb-2">Glissez ici pour mettre de côté</p>
            <DroppableParking>
              {parking.length === 0 && (
                <p className="text-[10px] text-gray-300 text-center py-3">Vide</p>
              )}
              {parking.map(act => (
                <DraggableParkingItem key={act.id} act={act} />
              ))}
            </DroppableParking>
          </div>
        </div>
      </div>
    )}
    </div>
    </DndContext>

    {/* ── Modale confirmation vider planning ─── */}
    {showConfirmViderPlanning && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => setShowConfirmViderPlanning(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          onClick={e => e.stopPropagation()}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Vider le planning ?</h2>
          <p className="text-sm text-gray-500 mb-5">Toutes les activités seront supprimées définitivement, y compris les activités manuelles. Cette action est irréversible.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmViderPlanning(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                if (!sejourId) return;
                try {
                  await Promise.all(planning.map(p => deletePlanning(sejourId, p.id)));
                  setPlanning([]);
                  setParking([]);
                } catch { /* ignore */ }
                setShowConfirmViderPlanning(false);
              }}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Supprimer tout
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Modale planning (création/édition) ─── */}
    {planModal?.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {planModal.editId ? 'Modifier l\'activité' : 'Ajouter une activité'}
            </h2>
            <button onClick={() => setPlanModal(null)}
              className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
              <input type="text" value={planModal.titre}
                onChange={e => setPlanModal(m => m ? { ...m, titre: e.target.value } : m)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Nom de l'activité" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heure début</label>
                <input type="time" value={planModal.heureDebut}
                  onChange={e => setPlanModal(m => m ? { ...m, heureDebut: e.target.value } : m)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heure fin</label>
                <input type="time" value={planModal.heureFin}
                  onChange={e => setPlanModal(m => m ? { ...m, heureFin: e.target.value } : m)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Responsable <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input type="text" value={planModal.responsable}
                onChange={e => setPlanModal(m => m ? { ...m, responsable: e.target.value } : m)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Nom du responsable" />
            </div>
            {user.role === 'HEBERGEUR' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Couleur du groupe <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COULEURS_ACTIVITE.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setPlanModal(m => m ? { ...m, couleur: c.hex } : m)}
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: planModal?.couleur === c.hex ? '#1B4060' : 'transparent',
                        transform: planModal?.couleur === c.hex ? 'scale(1.25)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const actExistante = planModal?.editId ? planning.find(p => p.id === planModal.editId) : null;
              const isActiviteIA = actExistante && actExistante.estManuelle === false;
              if (isActiviteIA) return null;
              return (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="estCollective"
                    checked={planModal?.estCollective ?? false}
                    onChange={e => setPlanModal(m => m ? { ...m, estCollective: e.target.checked } : m)}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]"
                  />
                  <label htmlFor="estCollective" className="text-xs font-medium text-gray-700">
                    Activité collective — tous les groupes en même temps
                  </label>
                </div>
              );
            })()}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setPlanModal(null)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            {planModal.editId && (
              <button
                onClick={async () => {
                  if (!sejourId || !planModal.editId) return;
                  await handleDeletePlanning(planModal.editId);
                  setPlanModal(null);
                }}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Supprimer
              </button>
            )}
            <button onClick={handleAddPlanning}
              disabled={!planModal.titre.trim()}
              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {planModal.editId ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
