import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Flame,
  Award,
  Zap,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  BarChart3,
  Settings as SettingsIcon,
  RotateCcw,
  Flag,
  Sparkles,
  ShieldAlert,
  Brain,
  Target,
  TrendingUp,
  BookOpen,
  Star,
  Trophy,
  Swords,
} from 'lucide-react'
import { MathView } from './components/MathView'
import { SplineSceneBasic } from '@/components/ui/demo'

/* ═══════════════ TYPES ═══════════════ */
interface PlayerProfile {
  player_id: string; display_name: string; is_anonymous: boolean; consent_dataset: boolean
  score: number; current_streak: number; total_labels: number; correct_labels: number; dragon_stage: string
  stats: { has_measured_stats: boolean; accuracy: string; eyesight: string; honesty: string; status_message: string }
}
interface RoundData {
  trace_id: string; problem_id: string; subject: string; difficulty: string; statement: string
  image_path: string | null; steps: string[]; final_answer: string; total_steps: number
}
interface VerdictData {
  verdict: 'correct' | 'close' | 'wrong' | 'ambiguous'; points_awarded: number
  streak: number; flaw_type: string | null; explanation: string; is_duplicate: boolean
}
interface TellsData {
  total_labels: number; labels_to_next_report: number; has_enough_data: boolean
  progress_percentage: number; total_flaws_caught: number
  breakdown: Array<{ flaw_type: string; label: string; count: number; percentage: number; description: string }>
  top_habit: string
}

/* ═══════════════ LEVEL CONFIG ═══════════════ */
/* ═══════════════ LEVEL CONFIG (3 LEVELS TOTAL) ═══════════════ */
const MAX_LEVELS = 3
const LEVELS = [
  { level: 1, title: 'Scout Critic',     xpNeeded: 0,    color: 'text-emerald-400', desc: 'Identify basic calculation flaws' },
  { level: 2, title: 'Logic Sleuth',     xpNeeded: 150,  color: 'text-blue-400',    desc: 'Detect subtle reasoning traps' },
  { level: 3, title: 'Master Validator', xpNeeded: 350,  color: 'text-amber-400',   desc: 'Complex multi-step chain validation' },
]

function getLevel(currentLvl: number = 1) {
  const levelIndex = Math.min(Math.max(currentLvl - 1, 0), MAX_LEVELS - 1)
  const current = LEVELS[levelIndex]
  const next = levelIndex + 1 < MAX_LEVELS ? LEVELS[levelIndex + 1] : null
  const pct = ((levelIndex + 1) / MAX_LEVELS) * 100
  return { ...current, next, pct }
}

/* ═══════════════ ROUND TIMER ═══════════════ */
const ROUND_TIME = 30 // seconds per round

/* ═══════════════ APP ═══════════════ */
export function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null)
  const [verdict, setVerdict] = useState<VerdictData | null>(null)
  const [tells, setTells] = useState<TellsData | null>(null)
  const [activeTab, setActiveTab] = useState<'play' | 'tells' | 'settings'>('play')
  const [isSessionComplete, setIsSessionComplete] = useState(false)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [roundStartTime, setRoundStartTime] = useState(Date.now())
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [flagReason, setFlagReason] = useState('ambiguous')

  // Game state (1, 2, or 3)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [totalXp, setTotalXp] = useState(0)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<typeof LEVELS[0] | null>(null)
  const [combo, setCombo] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [timer, setTimer] = useState(ROUND_TIME)
  const [timerActive, setTimerActive] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number }>>([])
  const [shaking, setShaking] = useState(false)
  const [roundStars, setRoundStars] = useState(0)
  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const particleId = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initRef = useRef(false)

  // Save game state
  useEffect(() => {
    try {
      localStorage.setItem('tyg_game_state', JSON.stringify({ totalXp, combo, currentLevel, isSessionComplete }))
    } catch { /* ignore */ }
  }, [totalXp, combo, currentLevel, isSessionComplete])

  // Timer countdown
  useEffect(() => {
    if (timerActive && timer > 0 && !verdict) {
      timerRef.current = setInterval(() => setTimer(t => {
        if (t <= 1) { setTimerActive(false); return 0 }
        return t - 1
      }), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerActive, verdict])

  // Stop timer on verdict
  useEffect(() => { if (verdict && timerRef.current) { clearInterval(timerRef.current); setTimerActive(false) } }, [verdict])

  /* ─── API Calls ─── */
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/me')
      if (res.ok) { setProfile(await res.json()) }
      else {
        const initRes = await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_anonymous: true }) })
        if (initRes.ok) { const meRes = await fetch('/me'); if (meRes.ok) setProfile(await meRes.json()) }
      }
    } catch { setErrorMsg('Failed to connect to backend server.') }
  }, [])

  const loadRound = useCallback(async (targetLevel?: number) => {
    const lvlToLoad = targetLevel !== undefined ? targetLevel : currentLevel
    if (lvlToLoad > MAX_LEVELS) {
      setIsSessionComplete(true)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    setVerdict(null)
    setShowRoundSummary(false)
    setRoundStars(0)
    try {
      const res = await fetch('/rounds/next')
      if (res.ok) {
        const data = await res.json()
        setCurrentRound(data)
        setRoundStartTime(Date.now())
        if (targetLevel !== undefined) {
          setCurrentLevel(targetLevel)
        }
        setTimer(ROUND_TIME)
        setTimerActive(true)
      } else {
        const err = await res.json().catch(() => null)
        setErrorMsg(err?.detail || 'No more rounds available right now.')
      }
    } catch {
      setErrorMsg('Failed to connect to backend server.')
    } finally {
      setLoading(false)
    }
  }, [currentLevel])

  const handleRestartSession = useCallback(async () => {
    try { localStorage.removeItem('tyg_game_state') } catch {}
    setTotalXp(0)
    setCombo(0)
    setCurrentLevel(1)
    setIsSessionComplete(false)
    setVerdict(null)
    setShowRoundSummary(false)
    await loadRound(1)
  }, [loadRound])

  const fetchTells = useCallback(async () => {
    try { const res = await fetch('/tells'); if (res.ok) setTells(await res.json()) } catch {}
  }, [])

  // Initial load
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    fetchProfile()
    let initialLvl = 1
    let shouldFetch = true
    try {
      const saved = localStorage.getItem('tyg_game_state')
      if (saved) {
        const s = JSON.parse(saved)
        // If legitimate completed state with XP > 0
        if (s.isSessionComplete && s.totalXp > 0) {
          setIsSessionComplete(true)
          setTotalXp(s.totalXp || 0)
          setCombo(s.combo || 0)
          setCurrentLevel(3)
          shouldFetch = false
        } else if (s.currentLevel && s.currentLevel <= MAX_LEVELS) {
          initialLvl = s.currentLevel
          setCurrentLevel(s.currentLevel)
          setTotalXp(s.totalXp || 0)
          setCombo(s.combo || 0)
        }
      }
    } catch {}

    if (shouldFetch) {
      loadRound(initialLvl)
    }
  }, [fetchProfile, loadRound])

  useEffect(() => { if (activeTab === 'tells') fetchTells() }, [activeTab, fetchTells])

  /* ─── Particles ─── */
  const spawnParticles = (x: number, y: number, count: number, colors: string[]) => {
    const newParticles = Array.from({ length: count }, () => ({
      id: particleId.current++,
      x: x + (Math.random() - 0.5) * 120,
      y: y + (Math.random() - 0.5) * 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
    }))
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id))), 1200)
  }

  /* ─── Submit ─── */
  const handleTapStep = async (tappedIndex: number | null) => {
    if (!currentRound || submitting) return
    setSubmitting(true)
    try {
      const elapsed = Date.now() - roundStartTime
      const res = await fetch(`/rounds/${currentRound.trace_id}/label`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tapped_index: tappedIndex, response_time_ms: elapsed }),
      })
      if (res.ok) {
        const data: VerdictData = await res.json()
        setVerdict(data)
        fetchProfile()

        // Calculate stars
        const timeBonus = timer > 20 ? 3 : timer > 10 ? 2 : timer > 0 ? 1 : 0
        const stars = data.verdict === 'correct' ? Math.max(timeBonus, 1) : data.verdict === 'close' ? 1 : 0
        setRoundStars(stars)

        // XP + combos
        const comboMultiplier = data.verdict === 'correct' ? Math.min(combo + 1, 5) : 0
        const xpGained = data.points_awarded + (comboMultiplier * 25)

        if (data.verdict === 'correct') {
          setCombo(prev => prev + 1)
          setShowCombo(true)
          setTimeout(() => setShowCombo(false), 800)
          // Particles
          spawnParticles(window.innerWidth / 2, 300, 15, ['#f97316', '#fbbf24', '#34d399', '#818cf8'])
        } else {
          setCombo(0)
          if (data.verdict === 'wrong') { setShaking(true); setTimeout(() => setShaking(false), 500) }
        }

        // Add XP
        const newXp = totalXp + xpGained
        setTotalXp(newXp)

        // Check level up across 3 levels
        if (currentLevel < MAX_LEVELS) {
          const nextLevelData = LEVELS[currentLevel]
          setTimeout(() => {
            setLevelUpData(nextLevelData)
            setShowLevelUp(true)
            spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 30, ['#a855f7', '#f97316', '#fbbf24', '#34d399', '#ec4899'])
            setTimeout(() => setShowLevelUp(false), 3000)
          }, 600)
        } else {
          // Level 3 final completion particles
          setTimeout(() => {
            spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 40, ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'])
          }, 500)
        }

        // Show round summary after delay
        setTimeout(() => setShowRoundSummary(true), 400)
      }
    } catch {} finally { setSubmitting(false) }
  }

  const handleReport = async () => {
    if (!currentRound) return
    try {
      await fetch('/flaw-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trace_id: currentRound.trace_id, reason: flagReason }) })
      setFlagModalOpen(false); loadRound()
    } catch { alert('Failed to submit report.') }
  }

  /* ─── Helpers ─── */
  const lvl = getLevel(currentLevel)
  const getDifficultyBadge = (d: string) => <span className={`badge badge-difficulty-${d}`}>{d}</span>
  const getSubjectIcon = (s: string) => {
    if (s.includes('algebra') || s.includes('arithmetic')) return <Brain className="w-3.5 h-3.5" />
    if (s.includes('geometry')) return <Target className="w-3.5 h-3.5" />
    if (s.includes('logic')) return <BookOpen className="w-3.5 h-3.5" />
    if (s.includes('probability')) return <TrendingUp className="w-3.5 h-3.5" />
    return <Zap className="w-3.5 h-3.5" />
  }
  const timerPct = (timer / ROUND_TIME) * 100
  const timerColor = timer > 20 ? 'text-emerald-400' : timer > 10 ? 'text-amber-400' : 'text-rose-400'
  const timerStroke = timer > 20 ? '#34d399' : timer > 10 ? '#fbbf24' : '#fb7185'

  return (
    <div className={`min-h-screen bg-animated text-slate-100 flex flex-col items-center ${shaking ? 'animate-shake' : ''}`}>
      {/* ─── Particles ─── */}
      {particles.map(p => (
        <div key={p.id} className="particle" style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.color }} />
      ))}

      {/* ─── Header ─── */}
      <header className="w-full max-w-4xl px-4 py-2.5 border-b border-slate-800/60 glass-panel sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-dragon-600 to-amber-500 p-0.5 shadow-lg shadow-dragon-600/30 flex items-center justify-center animate-float">
            <span className="text-2xl">🐉</span>
          </div>
          <div>
            <h1 className="font-black text-xl sm:text-2xl tracking-tight shimmer-text leading-tight">Train Your Gemma</h1>
            <div className="flex items-center space-x-1.5 text-[11px] font-medium">
              <span className={`font-bold ${lvl.color}`}>Level {lvl.level} of {MAX_LEVELS}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{lvl.title}</span>
              {isSessionComplete && <span className="text-emerald-400 font-bold ml-1">• COMPLETED</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {combo > 1 && (
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-900/60 to-fuchsia-900/40 border border-purple-700/40 text-xs font-bold text-purple-300 ${showCombo ? 'animate-combo' : ''}`}>
              <Swords className="w-3.5 h-3.5" />
              <span>{combo}x</span>
            </div>
          )}
          <div className="flex items-center space-x-1 bg-slate-900/90 border border-slate-700/50 px-2.5 py-1 rounded-full text-xs font-bold">
            <Flame className={`w-3.5 h-3.5 text-dragon-500 ${(profile?.current_streak || 0) >= 3 ? 'animate-fire' : ''}`} />
            <span className="text-slate-200 stat-number">{profile?.current_streak || 0}</span>
          </div>
          <div className="flex items-center space-x-1 bg-slate-900/90 border border-slate-700/50 px-2.5 py-1 rounded-full text-xs font-bold">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 stat-number">{totalXp}</span>
          </div>
        </div>
      </header>

      {/* ─── 3-Level Progression Bar ─── */}
      <div className="w-full max-w-4xl px-4 pt-2 pb-1">
        <div className="flex items-center space-x-2 text-[10px]">
          <span className={`font-bold ${lvl.color}`}>LEVEL {lvl.level} / {MAX_LEVELS}</span>
          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50 flex">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`h-full flex-1 transition-all duration-500 border-r border-slate-800/60 last:border-r-0 ${
                  lvl.level >= step
                    ? 'bg-gradient-to-r from-dragon-500 via-amber-400 to-yellow-300'
                    : 'bg-slate-800/40'
                }`}
              />
            ))}
          </div>
          <span className="text-slate-400 font-mono font-bold">
            {isSessionComplete ? '3/3 CONQUERED' : `LEVEL ${lvl.level}`}
          </span>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <nav className="w-full max-w-4xl px-4 pt-1 flex space-x-1 border-b border-slate-800/40">
        {([
          { key: 'play' as const, label: 'Play (Home)', icon: <Zap className="w-4 h-4" /> },
          { key: 'tells' as const, label: 'Tells', icon: <BarChart3 className="w-4 h-4" /> },
          { key: 'settings' as const, label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all min-h-[40px] flex items-center space-x-1.5 ${
              activeTab === tab.key ? 'bg-slate-900/80 text-dragon-400 border-t-2 border-x border-dragon-500 border-x-slate-800/40' : 'text-slate-500 hover:text-slate-300'
            }`}
          >{tab.icon}<span>{tab.label}</span></button>
        ))}
      </nav>

      {/* ─── Main ─── */}
      <main className="w-full max-w-4xl px-4 py-4 flex-1 flex flex-col">

        {/* ─── PLAY TAB ─── */}
        {activeTab === 'play' && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* ─── Cursor-Tracking 3D Robot Companion directly on Home Tab ─── */}
            {!isSessionComplete && (
              <SplineSceneBasic
                level={lvl.level}
                maxLevels={MAX_LEVELS}
                title="Interactive 3D Gemma"
                subtitle="Move your cursor across the card to see Gemma track your movements in real time while you evaluate reasoning steps below."
              />
            )}

            {isSessionComplete ? (
              /* ─── All 3 Levels Completed Celebration Screen ─── */
              <div className="glass-card rounded-2xl p-8 sm:p-10 text-center space-y-6 border border-purple-800/40 glow-purple animate-scale-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-2xl animate-float">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>3 / 3 Levels Conquered • Model Training Terminated</span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight">🎉 3-Level Training Complete!</h2>
                  <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
                    You have successfully guided Gemma 4 through all 3 evaluation levels. Training run terminated!
                  </p>
                </div>

                {/* 3D Robot Companion on Completion Screen */}
                <div className="max-w-xl mx-auto">
                  <SplineSceneBasic
                    level={3}
                    maxLevels={3}
                    title="Gemma 4 Fully Calibrated"
                    subtitle="Your 3D Gemma companion has graduated through all 3 levels of reasoning calibration."
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                  <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-700/40">
                    <div className="text-2xl font-black text-dragon-400 stat-number">3 / 3</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Levels</div>
                  </div>
                  <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-700/40">
                    <div className="text-2xl font-black text-amber-400 stat-number">{totalXp}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Total XP</div>
                  </div>
                  <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-700/40">
                    <div className="text-2xl font-black text-purple-400 stat-number">{combo}x</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Best Streak</div>
                  </div>
                </div>

                <div className="flex justify-center space-x-1.5 pt-1">
                  {[1, 2, 3].map(i => (
                    <Star key={i} className="w-7 h-7 text-amber-400 fill-amber-400 animate-star" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>

                <div className="pt-2">
                  <button onClick={handleRestartSession}
                    className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-dragon-600 via-amber-500 to-dragon-500 hover:from-dragon-500 hover:to-amber-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-xl min-h-[48px] inline-flex items-center space-x-2 transition-all active:scale-[0.98]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Start New 3-Level Session</span>
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="glass-card rounded-2xl p-14 text-center flex flex-col items-center justify-center space-y-4 border border-slate-700/30">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-dragon-500 animate-spin-slow" />
                  <Zap className="w-5 h-5 text-dragon-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Loading Level {currentLevel}...</p>
              </div>
            ) : errorMsg ? (
              errorMsg.includes('No more') || errorMsg.includes('available') ? (
                /* ─── All Rounds Completed Fallback ─── */
                <div className="glass-card rounded-2xl p-10 text-center space-y-6 border border-purple-800/30 glow-purple animate-scale-in">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-2xl">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">🎉 All 3 Levels Complete!</h2>
                    <p className="text-sm text-slate-400 mt-2">Training session complete across all 3 levels.</p>
                  </div>
                  <button onClick={handleRestartSession} className="px-6 py-2.5 bg-dragon-600 hover:bg-dragon-500 text-white rounded-xl text-sm font-bold min-h-[44px] transition-all shadow-lg">Start New Session</button>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-10 text-center space-y-4 border border-amber-900/30 animate-scale-in">
                  <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-sm text-slate-300">{errorMsg}</p>
                  <button onClick={() => loadRound()} className="px-6 py-2.5 bg-dragon-600 hover:bg-dragon-500 text-white rounded-xl text-sm font-bold min-h-[44px] transition-all shadow-lg">Retry</button>
                </div>
              )
            ) : currentRound ? (
              <>
                {/* ─── Round Header with Timer ─── */}
                <div className="flex items-center justify-between animate-slide-up">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/40 text-xs font-bold text-slate-300">
                      {getSubjectIcon(currentRound.subject)}
                      <span>{currentRound.subject.replace(/_/g, ' ')}</span>
                    </div>
                    {getDifficultyBadge(currentRound.difficulty)}
                    <span className="text-[10px] text-slate-400 font-bold font-mono">Level {currentLevel} of {MAX_LEVELS}</span>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center space-x-2">
                    {!verdict && (
                      <div className="flex items-center space-x-1.5">
                        <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
                          <circle cx="14" cy="14" r="11" fill="none" stroke="#1e293b" strokeWidth="2.5" />
                          <circle cx="14" cy="14" r="11" fill="none" stroke={timerStroke} strokeWidth="2.5"
                            strokeDasharray={`${2 * Math.PI * 11}`}
                            strokeDashoffset={`${2 * Math.PI * 11 * (1 - timerPct / 100)}`}
                            strokeLinecap="round" className="timer-ring" />
                        </svg>
                        <span className={`text-sm font-mono font-extrabold ${timerColor}`}>{timer}s</span>
                      </div>
                    )}
                    <button onClick={() => setFlagModalOpen(true)} className="text-slate-600 hover:text-slate-400 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors">
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ─── Problem Statement ─── */}
                <div className="glass-card rounded-2xl p-5 border border-slate-700/40 animate-slide-up" style={{ animationDelay: '80ms' }}>
                  <MathView content={currentRound.statement} className="text-base sm:text-lg font-semibold text-slate-50 leading-relaxed" />
                  {currentRound.image_path && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-700/40 bg-slate-900/90 flex justify-center p-3">
                      <img src={`/${currentRound.image_path}`} alt="Problem chart" className="max-h-56 object-contain rounded-lg" loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    </div>
                  )}
                </div>

                {/* ─── Steps (all revealed at once) ─── */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-[11px] px-1">
                    <Brain className="w-3.5 h-3.5 text-dragon-500" />
                    <span className="font-extrabold text-slate-400 uppercase tracking-wider">Reasoning Steps</span>
                    <span className="text-slate-600">— Tap the FIRST wrong step</span>
                  </div>

                  {currentRound.steps.map((stepText, idx) => (
                    <button key={idx} disabled={submitting || verdict !== null}
                      onClick={() => handleTapStep(idx)}
                      className={`step-card w-full text-left p-3.5 rounded-xl border text-sm leading-relaxed min-h-[48px] flex items-start space-x-3 animate-slide-up ${
                        verdict !== null ? 'opacity-75 cursor-default border-slate-800/40 bg-slate-900/20' : 'border-slate-700/40 bg-slate-900/40'
                      }`}
                      style={{ animationDelay: `${150 + idx * 70}ms` }}
                    >
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-lg font-extrabold shrink-0 mt-0.5 ${
                        verdict !== null ? 'bg-slate-800/40 text-slate-600' : 'bg-dragon-950/60 text-dragon-400 border border-dragon-900/30'
                      }`}>{idx + 1}</span>
                      <div className="flex-1"><MathView content={stepText} /></div>
                    </button>
                  ))}
                </div>

                {/* ─── Final Answer ─── */}
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-700/40 flex items-center justify-between text-sm animate-slide-up" style={{ animationDelay: `${200 + currentRound.steps.length * 70}ms` }}>
                  <span className="text-slate-500 flex items-center space-x-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /><span>Model's Answer:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-300 bg-amber-900/15 px-3 py-1 rounded-lg border border-amber-800/20">{currentRound.final_answer}</span>
                </div>

                {/* ─── Flawless Button or Verdict ─── */}
                {verdict === null ? (
                  <button disabled={submitting} onClick={() => handleTapStep(null)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 text-white shadow-xl shadow-emerald-950/40 flex items-center justify-center space-x-2 min-h-[48px] active:scale-[0.985]"
                  >
                    <Sparkles className="w-4.5 h-4.5" />
                    <span>Flawless — No Mistakes</span>
                  </button>
                ) : showRoundSummary ? (
                  /* ─── Round Summary Card ─── */
                  <div className={`rounded-2xl p-5 border shadow-2xl space-y-4 animate-confetti ${
                    verdict.verdict === 'correct' ? 'bg-emerald-950/40 border-emerald-700/40 glow-emerald'
                    : verdict.verdict === 'close' ? 'bg-amber-950/40 border-amber-700/40 glow-orange'
                    : 'bg-rose-950/40 border-rose-700/40 glow-rose'
                  }`}>
                    {/* Verdict Title */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          verdict.verdict === 'correct' ? 'bg-emerald-800/40' : verdict.verdict === 'close' ? 'bg-amber-800/40' : 'bg-rose-800/40'
                        }`}>
                          {verdict.verdict === 'correct' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                           : verdict.verdict === 'close' ? <AlertTriangle className="w-6 h-6 text-amber-400" />
                           : <XCircle className="w-6 h-6 text-rose-400" />}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-lg uppercase tracking-wide text-slate-100">
                            {verdict.verdict === 'correct' ? '🎯 Spot On!' : verdict.verdict === 'close' ? '🔥 Close!' : '💀 Missed!'}
                          </h3>
                          {verdict.flaw_type && <span className="text-[10px] font-mono text-slate-400">{verdict.flaw_type.replace(/_/g, ' ')}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-extrabold text-lg text-amber-300 animate-number-pop block">+{verdict.points_awarded}</span>
                        <span className="text-[10px] text-slate-500">XP earned</span>
                      </div>
                    </div>

                    {/* Stars */}
                    <div className="flex items-center justify-center space-x-1.5 py-1">
                      {[1, 2, 3].map(s => (
                        <Star key={s} className={`w-7 h-7 animate-star ${s <= roundStars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                          style={{ animationDelay: `${s * 150}ms` }} />
                      ))}
                    </div>

                    {/* Explanation */}
                    <p className="text-xs font-medium leading-relaxed text-slate-300 bg-slate-900/30 rounded-xl p-3 border border-slate-700/20">{verdict.explanation}</p>

                    {/* Combo + Time Bonus */}
                    <div className="flex items-center justify-center space-x-3 text-[11px]">
                      {combo > 0 && verdict.verdict === 'correct' && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-900/30 border border-purple-700/30 text-purple-300 font-bold">
                          🔥 {combo}x Combo
                        </span>
                      )}
                      {timer > 0 && verdict.verdict === 'correct' && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 text-blue-300 font-bold">
                          ⚡ {timer}s remaining
                        </span>
                      )}
                    </div>

                    {/* Next Level or Complete Training Button */}
                    {currentLevel >= MAX_LEVELS ? (
                      <button onClick={() => setIsSessionComplete(true)}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-xl min-h-[48px] flex items-center justify-center space-x-2 transition-all active:scale-[0.99]"
                      >
                        <Trophy className="w-5 h-5 text-amber-300" />
                        <span>Complete Model Training (Level 3 Finished)</span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    ) : (
                      <button onClick={() => loadRound(currentLevel + 1)}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-dragon-600 to-dragon-500 hover:from-dragon-500 hover:to-dragon-400 text-white font-bold text-sm uppercase tracking-wider shadow-lg min-h-[44px] flex items-center justify-center space-x-2 transition-all active:scale-[0.99]"
                      >
                        <span>Proceed to Level {currentLevel + 1}</span><ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-slate-600 animate-spin-slow" />
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ─── TELLS TAB ─── */}
        {activeTab === 'tells' && (
          <div className="space-y-5 animate-slide-up">
            {/* Level Card */}
            <div className="glass-card rounded-2xl p-5 border border-slate-700/40 flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-dragon-600 to-amber-500 flex items-center justify-center shadow-lg shadow-dragon-600/20">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`font-extrabold text-xl ${lvl.color}`}>Level {lvl.level}</span>
                  <span className="text-xs text-slate-400">— {lvl.title}</span>
                </div>
                <div className="flex items-center space-x-2 mt-1.5 text-[10px]">
                  <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                    <div className="xp-bar-fill h-full bg-gradient-to-r from-dragon-500 via-amber-400 to-yellow-300 rounded-full" style={{ width: `${lvl.pct}%` }} />
                  </div>
                  <span className="font-mono text-slate-500 font-bold">{totalXp} XP</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-700/40 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-50 flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-dragon-500" /><span>Habit Profile</span>
                </h3>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/80 text-dragon-400 border border-slate-700/40">
                  {tells?.total_labels || 0} Labels
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/30">
                <div className="xp-bar-fill h-full bg-gradient-to-r from-dragon-500 to-amber-400 rounded-full" style={{ width: `${tells?.progress_percentage || 0}%` }} />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-700/40 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-dragon-500" /><span>Slips Detected</span>
              </h4>
              {tells && tells.breakdown.length > 0 ? (
                <div className="space-y-2.5">
                  {tells.breakdown.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-200">{item.label}</span>
                        <span className="text-dragon-400 font-mono">{item.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="xp-bar-fill h-full bg-dragon-500 rounded-full" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-700/30 rounded-xl space-y-2">
                  <HelpCircle className="w-7 h-7 text-slate-600 mx-auto" />
                  <p>No habits detected yet. Keep playing!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {activeTab === 'settings' && (
          <div className="glass-card rounded-2xl p-5 border border-slate-700/40 space-y-5 animate-slide-up">
            <h3 className="text-base font-extrabold text-slate-50 flex items-center space-x-2">
              <SettingsIcon className="w-4 h-4 text-dragon-500" /><span>Settings & Privacy</span>
            </h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/80 border border-slate-700/40">
              <div className="pr-4">
                <div className="font-bold text-sm text-slate-200">Public Dataset Participation</div>
                <div className="text-xs text-slate-400 mt-1">Opt-in to feed your verified catches into open-source research.</div>
              </div>
              <input type="checkbox" checked={profile?.consent_dataset || false}
                onChange={async (e) => {
                  await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent_dataset: e.target.checked }) })
                  fetchProfile()
                }}
                className="w-5 h-5 accent-dragon-500 cursor-pointer" />
            </div>
            <div className="pt-3 border-t border-slate-700/30 flex justify-between items-center text-[10px] text-slate-500">
              <span className="font-mono">ID: {profile?.player_id?.slice(0, 8)}...</span>
              <span className="font-bold">v0.1.0 • Gemma 4</span>
            </div>
          </div>
        )}
      </main>

      {/* ─── Level-Up Overlay ─── */}
      {showLevelUp && levelUpData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-level-up-bg" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(0,0,0,0.85) 70%)' }}>
          <div className="text-center space-y-4 animate-level-up">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-2xl glow-purple">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <div>
              <p className="text-purple-300 text-sm font-bold uppercase tracking-[0.2em]">Level Up!</p>
              <h2 className="text-4xl font-black text-white mt-1">Level {levelUpData.level}</h2>
              <p className={`text-lg font-bold mt-1 ${levelUpData.color}`}>{levelUpData.title}</p>
            </div>
            <div className="flex justify-center space-x-1">
              {Array.from({ length: levelUpData.level }, (_, i) => (
                <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400 animate-star" style={{ animationDelay: `${i * 100 + 300}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Flag Modal ─── */}
      {flagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full border border-slate-700/50 space-y-4 shadow-2xl">
            <h4 className="font-extrabold text-sm text-slate-50 flex items-center space-x-2"><Flag className="w-4 h-4 text-dragon-500" /><span>Report Issue</span></h4>
            <select value={flagReason} onChange={(e) => setFlagReason(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs">
              <option value="answer_key_wrong">Answer key seems wrong</option>
              <option value="ambiguous">Problem is ambiguous</option>
              <option value="broken_image">Chart broken</option>
              <option value="other">Other</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setFlagModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold min-h-[40px]">Cancel</button>
              <button onClick={handleReport} className="px-4 py-2 rounded-xl bg-dragon-600 text-white text-xs font-bold min-h-[40px] shadow-lg">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App
