'use client'

import { Send, Clock, Search, RefreshCw, CheckCircle } from 'lucide-react'

interface ProgressTimelineProps {
  status: string
  totalIterations: number
  iterationsCompleted: number
}

type Step = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  key: string
}

const STEPS: Step[] = [
  { label: 'Send', icon: Send, key: 'send' },
  { label: 'Wait', icon: Clock, key: 'wait' },
  { label: 'Check Gmail', icon: Search, key: 'check' },
  { label: 'Rewrite', icon: RefreshCw, key: 'rewrite' },
]

function getCurrentStep(status: string, iterationsCompleted: number): number {
  if (status === 'pending') return -1
  if (status === 'success' || status === 'max_iterations' || status === 'cancelled') return 4
  // When running: cycle through steps based on what phase we're likely in
  // We can't know exactly, but we approximate
  if (status === 'running') {
    if (iterationsCompleted === 0) return 1 // waiting after first send
    return 3 // rewriting after checking
  }
  return -1
}

export default function ProgressTimeline({ status, totalIterations, iterationsCompleted }: ProgressTimelineProps) {
  const isDone = ['success', 'max_iterations', 'cancelled', 'failed'].includes(status)
  const isSuccess = status === 'success'
  const currentStep = getCurrentStep(status, iterationsCompleted)

  return (
    <div className="space-y-3">
      {/* Step bar */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = !isDone && idx === currentStep
          const isComplete = isDone || idx < currentStep

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950'
                      : isComplete
                      ? 'bg-green-800 text-green-300'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                </div>
                <span className={`text-xs font-medium ${
                  isActive ? 'text-blue-400' : isComplete ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full ${
                  isComplete ? 'bg-green-700' : 'bg-gray-700'
                }`} />
              )}
            </div>
          )
        })}

        {/* Done marker */}
        <div className="flex flex-col items-center gap-1 ml-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
            isSuccess ? 'bg-green-600 text-white' :
            isDone ? 'bg-yellow-800 text-yellow-300' :
            'bg-gray-800 text-gray-500'
          }`}>
            <CheckCircle className="w-4 h-4" />
          </div>
          <span className={`text-xs font-medium ${
            isSuccess ? 'text-green-400' : isDone ? 'text-yellow-400' : 'text-gray-500'
          }`}>Done</span>
        </div>
      </div>

      {/* Iteration counter */}
      {status === 'running' && (
        <div className="text-center text-sm text-gray-400">
          Iteration{' '}
          <span className="text-white font-semibold">{totalIterations}</span>
          {iterationsCompleted > 0 && (
            <span className="text-gray-500"> · {iterationsCompleted} completed</span>
          )}
        </div>
      )}
    </div>
  )
}
