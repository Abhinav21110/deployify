import { useState, useEffect } from 'react';
import { useBlurReveal } from '@/hooks/useBlurReveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Github, FolderGit2, Sparkles, DollarSign, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Features() {
  useBlurReveal();
  const [repoUrl, setRepoUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);

  // Scroll to results when they appear
  useEffect(() => {
    if (scanResults) {
      setTimeout(() => {
        const resultsElement = document.getElementById('scan-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [scanResults]);

  const sampleRepos = [
    {
      name: 'react-ecommerce-app',
      url: 'https://github.com/example/react-ecommerce',
      description: 'Full-stack e-commerce platform built with React and Node.js',
      stars: '2.3k',
      language: 'TypeScript',
      icon: '🛒'
    },
    {
      name: 'nextjs-blog-starter',
      url: 'https://github.com/example/nextjs-blog',
      description: 'Modern blog template with Next.js and Tailwind CSS',
      stars: '1.8k',
      language: 'JavaScript',
      icon: '📝'
    },
    {
      name: 'vue-dashboard',
      url: 'https://github.com/example/vue-dashboard',
      description: 'Admin dashboard with Vue 3 and Composition API',
      stars: '945',
      language: 'Vue',
      icon: '📊'
    },
    {
      name: 'express-rest-api',
      url: 'https://github.com/example/express-api',
      description: 'RESTful API with Express, MongoDB, and JWT authentication',
      stars: '1.2k',
      language: 'Node.js',
      icon: '🔌'
    },
  ];

  const handleScan = async (urlToScan?: string) => {
    const targetUrl = urlToScan || repoUrl;
    if (!targetUrl.trim()) {
      toast.error('Please enter a valid repository URL or folder path');
      return;
    }

    setIsScanning(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      const mockResults = {
        techStack: [
          { name: 'React', version: '18.3.1', icon: '⚛️' },
          { name: 'TypeScript', version: '5.0', icon: '🔷' },
          { name: 'Vite', version: '5.0', icon: '⚡' },
          { name: 'Tailwind CSS', version: '3.4', icon: '🎨' },
        ],
        deploymentOptions: [
          {
            platform: 'Vercel',
            price: '$0-20/month',
            features: ['Auto SSL', 'Global CDN', 'Instant Rollback'],
            rating: 4.9,
            recommended: true,
          },
          {
            platform: 'Netlify',
            price: '$0-19/month',
            features: ['Continuous Deployment', 'Form Handling', 'A/B Testing'],
            rating: 4.8,
          },
          {
            platform: 'AWS Amplify',
            price: '$0.01/build min',
            features: ['Full AWS Integration', 'Backend Services', 'GraphQL API'],
            rating: 4.6,
          },
          {
            platform: 'Cloudflare Pages',
            price: '$0-20/month',
            features: ['Unlimited Bandwidth', 'Built-in Analytics', 'Edge Functions'],
            rating: 4.7,
          },
        ],
        availableDomains: [
          { domain: 'yourapp.com', price: '$12/year', available: true },
          { domain: 'yourapp.io', price: '$35/year', available: true },
          { domain: 'yourapp.dev', price: '$15/year', available: true },
          { domain: 'yourapp.app', price: '$18/year', available: false },
        ],
        deploymentProcess: {
          steps: [
            'Build configuration detected: Vite build system',
            'Output directory: dist/',
            'Node version: 18.x recommended',
            'Environment variables: 3 detected',
            'Estimated build time: 2-3 minutes',
          ],
          recommendation: 'Based on your tech stack, we recommend Vercel for optimal performance and cost efficiency. It provides excellent React/Vite support with zero configuration.',
        },
      };

      setScanResults(mockResults);
      setIsScanning(false);
      toast.success('Repository analysis complete!');
    }, 3000);
  };

  return (
    <div className="min-h-screen text-white pb-32 px-4">
      <div className="max-w-7xl mx-auto pt-20">
        <div className="text-center mb-16 blur-reveal">
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Smart Deployment Scanner
            </span>
          </h1>
          <p className="text-xl max-w-3xl mx-auto" style={{color: '#d8d8e8'}}>
            Let our AI analyze your project and recommend the perfect deployment strategy
          </p>
        </div>

        {/* Sample Repositories Section */}
        <div className="max-w-6xl mx-auto mb-16 blur-reveal blur-reveal-delay-100">
          <Card className="p-8 glass-card">
            <div className="flex items-center gap-4 mb-6">
              <Sparkles className="h-6 w-6 text-purple-400" />
              <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Try Sample Repositories</h2>
            </div>
            <p className="mb-6" style={{color: '#d8d8e8'}}>Click on any sample repository to see instant analysis</p>
            <div className="grid md:grid-cols-2 gap-4">
              {sampleRepos.map((repo, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setRepoUrl(repo.url);
                    setSelectedSample(repo.url);
                    handleScan(repo.url);
                  }}
                  className={`p-6 rounded-xl glass-card cursor-pointer card-hover ${
                    selectedSample === repo.url ? 'ring-2 ring-purple-400' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{repo.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold" style={{color: '#e8e8f0'}}>{repo.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">
                          {repo.language}
                        </span>
                      </div>
                      <p className="text-sm mb-3" style={{color: '#d8d8e8'}}>{repo.description}</p>
                      <div className="flex items-center gap-2 text-sm" style={{color: '#b8b8c8'}}>
                        <span>⭐</span>
                        <span>{repo.stars} stars</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Input Section */}
        <div className="max-w-3xl mx-auto mb-16 blur-reveal blur-reveal-delay-100">
          <Card className="p-8 glass-card">
            <div className="flex items-center gap-4 mb-4">
              <Github className="h-6 w-6 text-indigo-400" />
              <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Enter Repository or Folder</h2>
            </div>
            <p className="mb-6" style={{color: '#d8d8e8'}}>
              Provide a Git repository URL or local folder path to analyze
            </p>
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="https://github.com/username/repo or /path/to/folder"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-gray-400 focus:bg-white/20"
              />
              <Button
                onClick={() => handleScan()}
                disabled={isScanning}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Results Section */}
        {scanResults && (
          <div id="scan-results" className="space-y-8" style={{animation: 'fadeIn 0.5s ease-in'}}>
            {/* Tech Stack */}
            <div>
              <Card className="p-8 glass-card">
                <div className="flex items-center gap-4 mb-6">
                  <FolderGit2 className="h-6 w-6 text-purple-400" />
                  <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Detected Tech Stack</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {scanResults.techStack.map((tech: any, index: number) => (
                    <div
                      key={index}
                      className="p-4 glass-card rounded-xl"
                    >
                      <div className="text-3xl mb-2">{tech.icon}</div>
                      <h3 className="font-bold" style={{color: '#e8e8f0'}}>{tech.name}</h3>
                      <p className="text-sm" style={{color: '#b8b8c8'}}>v{tech.version}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Deployment Options */}
            <div>
              <Card className="p-8 glass-card">
                <div className="flex items-center gap-4 mb-6">
                  <DollarSign className="h-6 w-6 text-green-400" />
                  <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Deployment Options & Pricing</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {scanResults.deploymentOptions.map((option: any, index: number) => (
                    <div
                      key={index}
                      className={`p-6 rounded-xl border ${
                        option.recommended
                          ? 'bg-gradient-to-br from-green-500/20 to-blue-500/20 border-green-400/30'
                          : 'bg-black/30 border-white/10'
                      }`}
                    >
                      {option.recommended && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-400/30 rounded-full text-xs text-green-400 mb-4">
                          <Sparkles className="h-3 w-3" />
                          Recommended
                        </div>
                      )}
                      <h3 className="text-xl font-bold mb-2">{option.platform}</h3>
                      <p className="text-2xl font-bold text-green-400 mb-4">{option.price}</p>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-yellow-400">★</span>
                        <span className="text-sm text-gray-400">{option.rating}/5.0</span>
                      </div>
                      <ul className="space-y-2">
                        {option.features.map((feature: string, fIndex: number) => (
                          <li key={fIndex} className="flex items-center gap-2 text-sm text-gray-300">
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Available Domains */}
            <div>
              <Card className="p-8 glass-card">
                <div className="flex items-center gap-4 mb-6">
                  <Globe className="h-6 w-6 text-blue-400" />
                  <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Available Domain Names</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {scanResults.availableDomains.map((domain: any, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        domain.available
                          ? 'bg-green-500/10 border-green-400/30'
                          : 'bg-red-500/10 border-red-400/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {domain.available ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                        <div>
                          <p className="font-bold" style={{color: '#e8e8f0'}}>{domain.domain}</p>
                          <p className="text-sm" style={{color: '#b8b8c8'}}>{domain.price}</p>
                        </div>
                      </div>
                      {domain.available && (
                        <Button size="sm" variant="outline" className="border-green-400/30 text-green-400 hover:bg-green-500/10">
                          Register
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Deployment Process */}
            <div>
              <Card className="p-8 glass-card">
                <h2 className="text-2xl font-display font-bold mb-6" style={{color: '#e8e8f0'}}>Deployment Process Overview</h2>
                <div className="space-y-4 mb-6">
                  {scanResults.deploymentProcess.steps.map((step: string, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-xs text-blue-400">{index + 1}</span>
                      </div>
                      <p style={{color: '#d8d8e8'}}>{step}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl border border-green-400/20">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-6 w-6 text-green-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold mb-2" style={{color: '#e8e8f0'}}>AI Recommendation</h3>
                      <p style={{color: '#d8d8e8'}}>{scanResults.deploymentProcess.recommendation}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
