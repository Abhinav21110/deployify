import { useBlurReveal } from '@/hooks/useBlurReveal';
import { Button } from '@/components/ui/button';
import { Rocket, Zap, Shield, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  useBlurReveal();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
      navigate('/features');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen text-white">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="blur-reveal mb-6">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500/10 backdrop-blur-md border border-orange-300/30 rounded-full text-sm">
              <span>✨</span>
              <span className="text-orange-100">Trusted by forward-thinking teams</span>
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-display font-bold mb-6 blur-reveal blur-reveal-delay-100">
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Deployify: Your AI Partner
            </span>
          </h1>

          <h2 className="text-5xl md:text-7xl font-display font-bold mb-8 blur-reveal blur-reveal-delay-200">
            <span className="bg-gradient-to-r from-purple-300 via-indigo-300 to-blue-300 bg-clip-text text-transparent">
              for Effortless Deployments
            </span>
          </h2>

          <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-12 blur-reveal blur-reveal-delay-300" style={{color: '#d8d8e8'}}>
            Smart, scalable, and seriously simple. Let Deployify handle the complexities, so you can build amazing things.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center blur-reveal blur-reveal-delay-400">
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              Get Started for Free <Rocket className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              onClick={() => navigate('/features')}
              className="glass-card text-white hover:bg-white/15 px-8 py-6 text-lg rounded-full"
            >
              Explore Features
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 blur-reveal">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
              Unique Features
            </h2>
            <p className="text-xl max-w-2xl mx-auto" style={{color: '#d8d8e8'}}>
              Intelligent automation powered by AI to streamline your deployment workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'AI Project Autonomy',
                description: "Deployify's intelligent core analyzes your project's structure, tech stack, and dependencies in seconds.",
                gradient: 'from-yellow-400 to-orange-500',
              },
              {
                icon: Shield,
                title: 'Adaptive Blueprint Generation',
                description: 'From Docker Compose to Kubernetes manifests – automatically generate optimal deployment artifacts.',
                gradient: 'from-blue-400 to-purple-500',
              },
              {
                icon: TrendingUp,
                title: 'Environment Sync & Drift Detection',
                description: 'Keep dev, staging, and production perfectly in sync with continuous monitoring and proactive corrections.',
                gradient: 'from-green-400 to-blue-500',
              },
              {
                icon: CheckCircle2,
                title: 'One-Click Rollback',
                description: 'Instantly roll back to any previous working deployment with intelligent root-cause analysis.',
                gradient: 'from-purple-400 to-pink-500',
              },
              {
                icon: Rocket,
                title: 'Predictive Scaling',
                description: 'AI learns your usage patterns to predict traffic spikes and scale resources proactively.',
                gradient: 'from-orange-400 to-red-500',
              },
              {
                icon: TrendingUp,
                title: 'Cost Optimization',
                description: 'Identify cost-saving opportunities in your cloud infrastructure automatically.',
                gradient: 'from-teal-400 to-blue-500',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className={`blur-reveal blur-reveal-delay-${index * 100} p-8 rounded-2xl glass-card card-hover`}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-4" style={{color: '#e8e8f0'}}>{feature.title}</h3>
                <p style={{color: '#d8d8e8'}}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 blur-reveal">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6 bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
              Loved by Developers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Sarah Chen',
                role: 'Lead Developer',
                quote: 'Deployify reduced our deployment time from hours to minutes. Absolutely game-changing!',
              },
              {
                name: 'Marcus Johnson',
                role: 'DevOps Engineer',
                quote: 'The AI-powered rollback feature saved us during a critical production issue. Incredible tool!',
              },
              {
                name: 'Emily Rodriguez',
                role: 'CTO',
                quote: 'Cost optimization insights alone paid for itself in the first month. Highly recommend!',
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className={`blur-reveal blur-reveal-delay-${index * 100} p-8 rounded-2xl glass-card card-hover`}
              >
                <p className="text-lg mb-6 italic" style={{color: '#d8d8e8'}}>"{testimonial.quote}"</p>
                <div>
                  <p className="font-bold" style={{color: '#e8e8f0'}}>{testimonial.name}</p>
                  <p className="text-sm" style={{color: '#b8b8c8'}}>{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-center blur-reveal">
          <h2 className="text-5xl md:text-6xl font-display font-bold mb-8 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            Ready to Deploy Smarter?
          </h2>
          <p className="text-xl mb-12" style={{color: '#d8d8e8'}}>
            Join thousands of teams already using Deployify to streamline their workflows
          </p>
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-12 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            Start Free Trial <Rocket className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
