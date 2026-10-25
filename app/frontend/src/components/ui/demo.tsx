'use client'

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"

interface SplineSceneBasicProps {
  className?: string;
  title?: string;
  subtitle?: string;
  level?: number;
  maxLevels?: number;
}

export function SplineSceneBasic({
  className = "w-full h-[280px] sm:h-[320px] bg-black/[0.96] relative overflow-hidden border border-slate-800/80 shadow-2xl rounded-2xl",
  title = "Interactive 3D Gemma",
  subtitle = "Move your cursor to see your 3D Gemma companion track your movements in real time.",
  level = 1,
  maxLevels = 3,
}: SplineSceneBasicProps) {
  return (
    <Card className={className}>
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex flex-col md:flex-row h-full">
        {/* Left content */}
        <div className="flex-1 p-5 sm:p-6 relative z-10 flex flex-col justify-center">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-dragon-500/10 border border-dragon-500/25 text-dragon-400 text-[11px] font-bold w-fit mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Level {level} of {maxLevels} Active</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-neutral-50 via-neutral-200 to-neutral-400 tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 max-w-md leading-relaxed">
            {subtitle}
          </p>
          <div className="mt-3.5 flex items-center space-x-3 text-[11px] text-neutral-400 font-medium">
            <span className="flex items-center space-x-1">
              <span className="text-amber-400">⚡</span>
              <span>Cursor Tracking</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="text-purple-400">🤖</span>
              <span>Spline 3D Model</span>
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">3 Levels Total</span>
          </div>
        </div>

        {/* Right content: 3D Scene */}
        <div className="flex-1 relative min-h-[160px] md:min-h-full">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  )
}
