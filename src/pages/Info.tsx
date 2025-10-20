import { useEffect } from 'react';
import { useBlurReveal } from '@/hooks/useBlurReveal';
import { Timeline } from '@/components/ui/timeline';
import { BookOpen, Zap, Settings2, Rocket } from 'lucide-react';

export default function Info() {
  useBlurReveal();

  const timelineData = [
    {
      title: 'Step 1',
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold mb-4" style={{color: '#e8e8f0'}}>Connect Your Repository</h3>
              <p className="mb-4" style={{color: '#d8d8e8'}}>
                Link your code repository from GitHub, GitLab, or Bitbucket. Deployify supports all major version control platforms.
              </p>
              <ul className="space-y-2" style={{color: '#b8b8c8'}}>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> GitHub integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> GitLab support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Bitbucket compatibility
                </li>
              </ul>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="glass-card p-6 rounded-xl">
              <p className="text-sm mb-2" style={{color: '#b8b8c8'}}>Average Setup Time</p>
              <p className="text-3xl font-bold" style={{color: '#e8e8f0'}}>30 sec</p>
            </div>
            <div className="glass-card p-6 rounded-xl">
              <p className="text-sm mb-2" style={{color: '#b8b8c8'}}>Repositories Supported</p>
              <p className="text-3xl font-bold" style={{color: '#e8e8f0'}}>Unlimited</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 2',
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center flex-shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold mb-4" style={{color: '#e8e8f0'}}>AI Analysis & Blueprint Generation</h3>
              <p className="mb-4" style={{color: '#d8d8e8'}}>
                Our intelligent AI analyzes your codebase, identifies your tech stack, and generates optimized deployment configurations automatically.
              </p>
              <div className="space-y-3">
                <div className="glass-card p-4 rounded-lg">
                  <p className="font-semibold mb-2" style={{color: '#e8e8f0'}}>Tech Stack Detection</p>
                  <p className="text-sm" style={{color: '#d8d8e8'}}>Identifies frameworks, languages, and dependencies</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                  <p className="font-semibold mb-2" style={{color: '#e8e8f0'}}>Smart Configuration</p>
                  <p className="text-sm" style={{color: '#d8d8e8'}}>Generates Docker, Kubernetes, or serverless configs</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                  <p className="font-semibold mb-2" style={{color: '#e8e8f0'}}>Environment Variables</p>
                  <p className="text-sm" style={{color: '#d8d8e8'}}>Automatically detects required environment variables</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 3',
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Settings2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold mb-4" style={{color: '#e8e8f0'}}>Review & Customize</h3>
              <p className="mb-4" style={{color: '#d8d8e8'}}>
                Review the generated deployment blueprint. Our AI makes smart recommendations, but you have full control to customize everything.
              </p>
              <div className="glass-card p-6 rounded-xl font-mono text-sm">
                <div className="flex items-center gap-2 mb-4" style={{color: '#b8b8c8'}}>
                  <span className="text-green-400">$</span>
                  <span>deployify.config.yaml</span>
                </div>
                <pre style={{color: '#d8d8e8'}}>
{`version: 1.0
framework: React + Vite
deployment:
  type: static
  cdn: enabled
  auto_ssl: true
environment:
  NODE_ENV: production`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 4',
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold mb-4" style={{color: '#e8e8f0'}}>Deploy with Confidence</h3>
              <p className="mb-6" style={{color: '#d8d8e8'}}>
                Hit deploy and watch Deployify work its magic. Real-time monitoring, automatic rollback on errors, and instant notifications keep you in control.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-6 rounded-xl">
                  <p className="text-4xl font-bold text-green-400 mb-2">99.9%</p>
                  <p className="text-sm" style={{color: '#b8b8c8'}}>Success Rate</p>
                </div>
                <div className="glass-card p-6 rounded-xl">
                  <p className="text-4xl font-bold text-blue-400 mb-2">&lt; 2min</p>
                  <p className="text-sm" style={{color: '#b8b8c8'}}>Avg Deploy Time</p>
                </div>
              </div>
              <div className="mt-6 p-6 glass-card rounded-xl border border-green-500/20">
                <p className="text-green-400 font-semibold mb-2">✓ Deployment Successful</p>
                <p className="text-sm" style={{color: '#d8d8e8'}}>Your application is live at: https://your-app.deployify.io</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen text-white pb-32">
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-20 blur-reveal">
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              How Deployify Works
            </span>
          </h1>
          <p className="text-xl max-w-3xl mx-auto" style={{color: '#d8d8e8'}}>
            From code to production in four simple steps. Let our AI handle the complexity while you focus on building.
          </p>
        </div>
      </div>

      <Timeline data={timelineData} />
    </div>
  );
}
