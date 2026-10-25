import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { DragonAvatar } from './components/DragonAvatar'
import { MathView } from './components/MathView'

interface PlayerProfile {
  player_id: string
  display_name: string
  is_anonymous: boolean
  consent_dataset: boolean
  score: number
  current_streak: number
  total_labels: number
  correct_labels: number
  dragon_stage: string
  stats: {
    has_measured_stats: boolean
    accuracy: string
    eyesight: string
    honesty: string
    status_message: string
  }
}

interface RoundData {
  trace_id: string
  problem_id: string
  subject: string
  difficulty: string
  statement: string
  image_path: string | null
  steps: string[]
  final_answer: string
  total_steps: number
}

interface VerdictData {
  verdict: 'correct' | 'close' | 'wrong' | 'ambiguous'
  points_awarded: number
  streak: number
  flaw_type: string | null
  explanation: string
  is_duplicate: boolean
}

interface TellsData {
  total_labels: number
  labels_to_next_report: number
  has_enough_data: boolean
  progress_percentage: number
  total_flaws_caught: number
  breakdown: Array<{
    flaw_type: string
    label: string
    count: number
    percentage: number
    description: string
  }>
  top_habit: string
}

export function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null)
  const [revealedStepCount, setRevealedStepCount] = useState<number>(1)
  const [verdict, setVerdict] = useState<VerdictData | null>(null)
  const [tells, setTells] = useState<TellsData | null>(null)
  const [activeTab, setActiveTab] = useState<'play' | 'tells' | 'settings'>('play')

  const [loading, setLoading] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [roundStartTime, setRoundStartTime] = useState<number>(Date.now())
  const [flagModalOpen, setFlagModalOpen] = useState<boolean>(false)
  const [flagReason, setFlagReason] = useState<string>('ambiguous')

  // Load player profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/me')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      } else {
        // Create initial session
        const initRes = await fetch('/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_anonymous: true }),
        })
        if (initRes.ok) {
          const initData = await initRes.json()
          setProfile({
            ...initData,
            score: 0,
            current_streak: 0,
            total_labels: 0,
            correct_labels: 0,
            dragon_stage: 'Hatchling',
            stats: {
              has_measured_stats: false,
              accuracy: 'Not measured yet',
              eyesight: 'Not measured yet',
              honesty: 'Not measured yet',
              status_message: 'Flight test needed to measure stats',
            },
          })
        }
      }
    } catch (e) {
      console.error('Failed to load player profile', e)
    }
  }, [])

  // Load next round
  const fetchNextRound = useCallback(async () => {
    setLoading(true)
    setVerdict(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/rounds/next')
      if (res.ok) {
        const data = await res.json()
        setCurrentRound(data)
        setRevealedStepCount(1)
        setRoundStartTime(Date.now())
      } else {
        const err = await res.json()
        setErrorMsg(err.detail || 'No more problems available right now.')
      }
    } catch (e) {
      setErrorMsg('Failed to connect to backend server.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load tells
  const fetchTells = useCallback(async () => {
    try {
      const res = await fetch('/tells')
      if (res.ok) {
        const data = await res.json()
        setTells(data)
      }
    } catch (e) {
      console.error('Failed to fetch dragon tells', e)
    }
  }, [])

  useEffect(() => {
    fetchProfile().then(() => {
      fetchNextRound()
      fetchTells()
    })
  }, [fetchProfile, fetchNextRound, fetchTells])

  // Submit step tap or Flawless
  const handleTapStep = async (stepIndex: number | null) => {
    if (!currentRound || submitting) return
    setSubmitting(true)

    const responseTime = Math.max(200, Date.now() - roundStartTime)

    try {
      const res = await fetch(`/rounds/${currentRound.trace_id}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tapped_index: stepIndex,
          response_time_ms: responseTime,
        }),
      })

      if (res.ok) {
        const result: VerdictData = await res.json()
        setVerdict(result)
        // Refresh profile & tells
        fetchProfile()
        fetchTells()
      } else {
        const err = await res.json()
        setErrorMsg(err.detail || 'Failed to submit label.')
      }
    } catch (e) {
      setErrorMsg('Network error submitting your choice.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle report trace
  const handleReport = async () => {
    if (!currentRound) return
    try {
      await fetch('/flaw-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trace_id: currentRound.trace_id,
          reason: flagReason,
        }),
      })
      setFlagModalOpen(false)
      alert('Report submitted! Thank you.')
      fetchNextRound()
    } catch (e) {
      alert('Failed to submit report.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* Top Header / Status Bar */}
      <header className="w-full max-w-4xl px-4 py-3 border-b border-slate-800/80 glass-panel sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-dragon-600 to-amber-500 p-0.5 shadow-md shadow-dragon-600/30 flex items-center justify-center">
            <span className="text-xl">🐉</span>
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-dragon-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
              Train Your Gemma
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
              <span className="text-dragon-400">{profile?.display_name || 'Hatchling'}</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{profile?.dragon_stage || 'Hatchling'}</span>
            </div>
          </div>
        </div>

        {/* Gamification stats */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Flame className="w-4 h-4 text-dragon-500 animate-pulse" />
            <span className="text-slate-200">{profile?.current_streak || 0} Streak</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300">{profile?.score || 0} pts</span>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="w-full max-w-4xl px-4 pt-3 flex space-x-2 border-b border-slate-900">
        <button
          onClick={() => setActiveTab('play')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors min-h-[44px] flex items-center space-x-2 ${
            activeTab === 'play'
              ? 'bg-slate-900 text-dragon-400 border-t-2 border-dragon-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Play Round</span>
        </button>

        <button
          onClick={() => setActiveTab('tells')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors min-h-[44px] flex items-center space-x-2 ${
            activeTab === 'tells'
              ? 'bg-slate-900 text-dragon-400 border-t-2 border-dragon-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Tells Report</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors min-h-[44px] flex items-center space-x-2 ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-dragon-400 border-t-2 border-dragon-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl px-4 py-6 flex-1 flex flex-col">
        {/* Dragon stats card at top */}
        <section className="glass-card rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center space-x-4">
            <DragonAvatar stage={profile?.dragon_stage || 'Hatchling'} size={80} celebrating={verdict?.verdict === 'correct'} />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-dragon-500">Mascot</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  google/gemma-2-2b-it
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100">{profile?.dragon_stage || 'Hatchling'} Gemma</h2>
              <p className="text-xs text-slate-400">Catch mistakes in reasoning to teach your hatchling a tail fin critic!</p>
            </div>
          </div>

          {/* Real stats display (Principle 1) */}
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto text-center">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Accuracy</div>
              <div className="text-sm font-bold text-slate-200 mt-0.5">{profile?.stats.accuracy}</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Eyesight</div>
              <div className="text-sm font-bold text-slate-200 mt-0.5">{profile?.stats.eyesight}</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Honesty</div>
              <div className="text-sm font-bold text-slate-200 mt-0.5">{profile?.stats.honesty}</div>
            </div>
          </div>
        </section>

        {/* TAB 1: PLAY ROUND */}
        {activeTab === 'play' && (
          <div className="flex-1 flex flex-col space-y-5">
            {loading ? (
              <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <RotateCcw className="w-8 h-8 text-dragon-500 animate-spin" />
                <p className="text-sm text-slate-400 font-medium">Summoning next problem trace...</p>
              </div>
            ) : errorMsg ? (
              <div className="glass-card rounded-2xl p-8 text-center space-y-3 border-red-900/40">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-sm text-slate-300">{errorMsg}</p>
                <button
                  onClick={fetchNextRound}
                  className="px-4 py-2 bg-dragon-600 hover:bg-dragon-500 text-white rounded-xl text-sm font-semibold min-h-[44px]"
                >
                  Retry
                </button>
              </div>
            ) : currentRound ? (
              <>
                {/* Problem Statement Card */}
                <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-dragon-950/80 text-dragon-400 font-semibold border border-dragon-900 uppercase">
                      {currentRound.subject.replace('_', ' ')} • {currentRound.difficulty}
                    </span>
                    <button
                      onClick={() => setFlagModalOpen(true)}
                      className="text-slate-400 hover:text-slate-200 flex items-center space-x-1 p-1 min-h-[44px]"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>
                  </div>

                  <MathView content={currentRound.statement} className="text-base sm:text-lg font-medium text-slate-100" />

                  {/* Programmatic / CC0 Chart Image if present */}
                  {currentRound.image_path && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-900/90 flex justify-center p-2">
                      <img
                        src={`/${currentRound.image_path}`}
                        alt="Problem visual chart"
                        className="max-h-64 object-contain rounded-lg"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Step-by-Step Reasoning Trace */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                    <span>MODEL REASONING TRACE (Tap the FIRST incorrect step)</span>
                    {revealedStepCount < currentRound.steps.length && !verdict && (
                      <button
                        onClick={() => setRevealedStepCount(currentRound.steps.length)}
                        className="text-dragon-400 hover:text-dragon-300 min-h-[44px] flex items-center"
                      >
                        Reveal all steps
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {currentRound.steps.slice(0, revealedStepCount).map((stepText, idx) => (
                      <button
                        key={idx}
                        disabled={submitting || verdict !== null}
                        onClick={() => handleTapStep(idx)}
                        className={`w-full text-left p-4 rounded-xl border transition-all text-sm leading-relaxed min-h-[56px] flex items-start space-x-3 ${
                          verdict !== null
                            ? 'opacity-85 cursor-default'
                            : 'hover:border-dragon-500/70 hover:bg-slate-900/80 active:scale-[0.99] border-slate-800/80 bg-slate-900/40'
                        }`}
                      >
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                          Step {idx + 1}
                        </span>
                        <div className="flex-1">
                          <MathView content={stepText} />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Step Reveal Progression Controls */}
                  {revealedStepCount < currentRound.steps.length && !verdict && (
                    <button
                      onClick={() => setRevealedStepCount((prev) => Math.min(prev + 1, currentRound.steps.length))}
                      className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-900 text-xs font-semibold flex items-center justify-center space-x-1.5 min-h-[44px]"
                    >
                      <span>Reveal Next Step</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Final Proposed Answer */}
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">Final Answer Stated:</span>
                  <span className="font-mono font-bold text-amber-300">{currentRound.final_answer}</span>
                </div>

                {/* Actions: "Flawless" Tap or Result Banner */}
                {verdict === null ? (
                  <div className="pt-2">
                    <button
                      disabled={submitting}
                      onClick={() => handleTapStep(null)}
                      className="w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide uppercase transition-all bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 min-h-[48px] active:scale-[0.99]"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Flawless (No Mistake in Trace)</span>
                    </button>
                  </div>
                ) : (
                  /* Instant Verdict & Feedback Card */
                  <div
                    className={`rounded-2xl p-5 border shadow-xl space-y-4 animate-in fade-in duration-300 ${
                      verdict.verdict === 'correct'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100'
                        : verdict.verdict === 'close'
                        ? 'bg-amber-950/40 border-amber-800 text-amber-100'
                        : 'bg-rose-950/40 border-rose-800 text-rose-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {verdict.verdict === 'correct' ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        ) : verdict.verdict === 'close' ? (
                          <AlertTriangle className="w-6 h-6 text-amber-400" />
                        ) : (
                          <XCircle className="w-6 h-6 text-rose-400" />
                        )}
                        <h3 className="font-extrabold text-lg uppercase tracking-wide">
                          {verdict.verdict === 'correct'
                            ? 'Spot On! Correct'
                            : verdict.verdict === 'close'
                            ? 'Close Catch!'
                            : 'Mistake Missed!'}
                        </h3>
                      </div>
                      <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-full bg-slate-900/80">
                        +{verdict.points_awarded} pts
                      </span>
                    </div>

                    <p className="text-sm font-medium leading-relaxed">{verdict.explanation}</p>

                    <button
                      onClick={fetchNextRound}
                      className="w-full py-3.5 rounded-xl bg-dragon-600 hover:bg-dragon-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-dragon-950/50 min-h-[48px] flex items-center justify-center space-x-2"
                    >
                      <span>Next Training Round</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* TAB 2: TELLS REPORT */}
        {activeTab === 'tells' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Dragon Habit Profile</h3>
                  <p className="text-xs text-slate-400">
                    Calculated strictly from your verified gameplay catches.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-dragon-400">
                  {tells?.total_labels || 0} / 20 Verified Labels
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-dragon-500 to-amber-400 transition-all duration-500 rounded-full"
                    style={{ width: `${tells?.progress_percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Current Milestone</span>
                  <span>{tells?.labels_to_next_report || 0} more labels to next report</span>
                </div>
              </div>
            </div>

            {/* Habit Breakdown */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Reasoning Slips Detected
              </h4>

              {tells && tells.breakdown.length > 0 ? (
                <div className="space-y-3">
                  {tells.breakdown.map((item, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-200">{item.label}</span>
                        <span className="text-dragon-400 font-mono">{item.percentage}% ({item.count})</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-dragon-500 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <HelpCircle className="w-6 h-6 text-slate-500 mx-auto" />
                  <p>No verified mistakes caught yet. Keep training to uncover your dragon's tells!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS & PRIVACY */}
        {activeTab === 'settings' && (
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <h3 className="text-lg font-bold text-slate-100">Dataset Consent & Privacy</h3>

            {/* Opt-in consent toggle (Principle 4) */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="pr-4">
                <div className="font-semibold text-sm text-slate-200">Public Dataset Participation</div>
                <div className="text-xs text-slate-400 mt-1">
                  Opt-in only. If enabled, your verified flaw catches feed into an open-source research dataset.
                  No personal data or emails are stored.
                </div>
              </div>
              <input
                type="checkbox"
                checked={profile?.consent_dataset || false}
                onChange={async (e) => {
                  const val = e.target.checked
                  await fetch('/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ consent_dataset: val }),
                  })
                  fetchProfile()
                }}
                className="w-5 h-5 accent-dragon-500 cursor-pointer min-w-[20px]"
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>Player ID: {profile?.player_id}</span>
              <span>v0.1.0 (Hackathon Edition)</span>
            </div>
          </div>
        )}
      </main>

      {/* Flag / Report Modal */}
      {flagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full border border-slate-800 space-y-4">
            <h4 className="font-bold text-base text-slate-100">Report Problem or Trace</h4>
            <div className="space-y-2 text-xs">
              <label className="text-slate-300">Reason</label>
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
              >
                <option value="answer_key_wrong">Answer key appears incorrect</option>
                <option value="ambiguous">Reasoning or problem is ambiguous</option>
                <option value="broken_image">Visual chart broken or unreadable</option>
                <option value="other">Other issue</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setFlagModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="px-4 py-2 rounded-lg bg-dragon-600 text-white text-xs font-semibold min-h-[44px]"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App
