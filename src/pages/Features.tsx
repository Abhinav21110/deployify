import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBlurReveal } from '@/hooks/useBlurReveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Github, Sparkles, Rocket, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient, deploymentRequestSchema, DeploymentRequest } from '@/lib/api';
import { DeployModal } from '@/components/DeployModal';

export default function Features() {
  useBlurReveal();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [environment, setEnvironment] = useState<'school' | 'staging' | 'prod'>('school');
  const [budget, setBudget] = useState<'free' | 'low' | 'any'>('free');
  const [preferProviders, setPreferProviders] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  
  const deployMutation = useMutation({
    mutationFn: (data: DeploymentRequest) => apiClient.createDeployment(data),
    onSuccess: (response) => {
      toast.success('Deployment started successfully!');
      setSelectedDeployment(response.deploymentId);
    },
    onError: (error: any) => {
      toast.error(`Failed to start deployment: ${error.message}`);
    },
  });

  const handleDeploy = async () => {
    try {
      const deploymentData = deploymentRequestSchema.parse({
        repoUrl,
        branch: branch || 'main',
        environment,
        budget,
        preferProviders: preferProviders.length > 0 ? preferProviders : undefined,
      });

      await deployMutation.mutateAsync(deploymentData);
    } catch (error: any) {
      if (error.errors) {
        // Zod validation errors
        const errorMessage = error.errors.map((e: any) => e.message).join(', ');
        toast.error(`Validation error: ${errorMessage}`);
      } else {
        toast.error('Failed to deploy');
      }
    }
  };

  const toggleProvider = (provider: string) => {
    setPreferProviders(prev => 
      prev.includes(provider) 
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const isValidGitHubUrl = (url: string) => {
    return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(url);
  };

  const canDeploy = repoUrl.trim() && isValidGitHubUrl(repoUrl) && !deployMutation.isPending;

  const sampleRepos = [
    {
      name: 'react-portfolio',
      url: 'https://github.com/vercel/portfolio-starter-kit',
      description: 'Modern portfolio built with Next.js and Tailwind CSS',
      stars: '2.3k',
      language: 'TypeScript',
      icon: '🎨',
      framework: 'Next.js',
    },
    {
      name: 'vue-todo-app',
      url: 'https://github.com/vuejs/vue-hackernews-2.0',
      description: 'HackerNews clone built with Vue.js and Server-Side Rendering',
      stars: '1.8k',
      language: 'JavaScript',
      icon: '📰',
      framework: 'Vue.js',
    },
    {
      name: 'static-docs-site',
      url: 'https://github.com/facebook/docusaurus',
      description: 'Documentation site built with Docusaurus',
      stars: '945',
      language: 'React',
      icon: '📚',
      framework: 'Docusaurus',
    },
    {
      name: 'express-api',
      url: 'https://github.com/Microsoft/TypeScript-Node-Starter',
      description: 'Node.js API starter with TypeScript and Express',
      stars: '8.1k',
      language: 'TypeScript',
      icon: '⚡',
      framework: 'Express.js',
    },
  ];

  const providers = [
    { id: 'netlify', name: 'Netlify', icon: '🌐', description: 'Static sites and JAMstack' },
    { id: 'vercel', name: 'Vercel', icon: '▲', description: 'Next.js and React apps' },
  ];

  return (
    <div className="min-h-screen text-white pb-32 px-4">
      <div className="max-w-7xl mx-auto pt-20">
        <div className="text-center mb-16 blur-reveal">
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Deploy Your Project
            </span>
          </h1>
          <p className="text-xl max-w-3xl mx-auto" style={{color: '#d8d8e8'}}>
            Automated deployment with intelligent provider selection and real-time monitoring
          </p>
        </div>

        {/* Sample Repositories Section */}
        <div className="max-w-6xl mx-auto mb-16 blur-reveal blur-reveal-delay-100">
          <Card className="p-8 glass-card">
            <div className="flex items-center gap-4 mb-6">
              <Sparkles className="h-6 w-6 text-purple-400" />
              <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Try Sample Repositories</h2>
            </div>
            <p className="mb-6" style={{color: '#d8d8e8'}}>Click on any sample repository to auto-fill and deploy</p>
            <div className="grid md:grid-cols-2 gap-4">
              {sampleRepos.map((repo, index) => (
                <div
                  key={index}
                  onClick={() => setRepoUrl(repo.url)}
                  className={cn(
                    "p-6 rounded-xl glass-card cursor-pointer card-hover transition-all",
                    repoUrl === repo.url && "ring-2 ring-purple-400"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{repo.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold" style={{color: '#e8e8f0'}}>{repo.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {repo.framework}
                        </Badge>
                      </div>
                      <p className="text-sm mb-3" style={{color: '#d8d8e8'}}>{repo.description}</p>
                      <div className="flex items-center gap-4 text-sm" style={{color: '#b8b8c8'}}>
                        <span className="flex items-center gap-1">
                          ⭐ {repo.stars}
                        </span>
                        <span className="text-purple-300">{repo.language}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Deployment Form */}
        <div className="max-w-4xl mx-auto space-y-8 blur-reveal blur-reveal-delay-200">
          {/* Repository Input */}
          <Card className="p-8 glass-card">
            <div className="flex items-center gap-4 mb-6">
              <Github className="h-6 w-6 text-indigo-400" />
              <h2 className="text-2xl font-display font-bold" style={{color: '#e8e8f0'}}>Repository Configuration</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="repo-url" className="text-sm font-medium" style={{color: '#e8e8f0'}}>
                  GitHub Repository URL *
                </Label>
                <Input
                  id="repo-url"
                  type="text"
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400 focus:bg-white/20"
                />
                {repoUrl && !isValidGitHubUrl(repoUrl) && (
                  <p className="text-red-400 text-sm mt-1">Please enter a valid GitHub repository URL</p>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="branch" className="text-sm font-medium" style={{color: '#e8e8f0'}}>
                    Branch
                  </Label>
                  <Input
                    id="branch"
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400 focus:bg-white/20"
                  />
                </div>

                <div>
                  <Label htmlFor="environment" className="text-sm font-medium" style={{color: '#e8e8f0'}}>
                    Environment
                  </Label>
                  <Select value={environment} onValueChange={(value: any) => setEnvironment(value)}>
                    <SelectTrigger className="mt-2 bg-white/10 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="school">School (Free)</SelectItem>
                      <SelectItem value="staging">Staging (Low Cost)</SelectItem>
                      <SelectItem value="prod">Production (Any Budget)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget" className="text-sm font-medium" style={{color: '#e8e8f0'}}>
                    Budget Preference
                  </Label>
                  <Select value={budget} onValueChange={(value: any) => setBudget(value)}>
                    <SelectTrigger className="mt-2 bg-white/10 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free Only</SelectItem>
                      <SelectItem value="low">Low Cost ($0-20/mo)</SelectItem>
                      <SelectItem value="any">Any Budget</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          {/* Advanced Options */}
          <Card className="p-8 glass-card">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-3 w-full text-left mb-4 hover:opacity-80 transition-opacity"
            >
              <Settings className="h-5 w-5 text-purple-400" />
              <h3 className="text-lg font-display font-bold" style={{color: '#e8e8f0'}}>Advanced Options</h3>
              <div className={cn("ml-auto transition-transform", showAdvanced && "rotate-180")}>
                ▼
              </div>
            </button>
            
            {showAdvanced && (
              <div className="space-y-6 border-t border-white/10 pt-6">
                <div>
                  <Label className="text-sm font-medium mb-4 block" style={{color: '#e8e8f0'}}>
                    Preferred Deployment Providers
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {providers.map((provider) => (
                      <div
                        key={provider.id}
                        onClick={() => toggleProvider(provider.id)}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all",
                          preferProviders.includes(provider.id)
                            ? "bg-purple-500/20 border-purple-400/50"
                            : "bg-white/5 border-white/20 hover:border-white/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={preferProviders.includes(provider.id)}
                            onChange={() => toggleProvider(provider.id)}
                            className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                          />
                          <div className="text-2xl">{provider.icon}</div>
                          <div>
                            <h4 className="font-medium" style={{color: '#e8e8f0'}}>{provider.name}</h4>
                            <p className="text-xs" style={{color: '#b8b8c8'}}>{provider.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Deploy Button */}
          <div className="text-center">
            <Button
              onClick={handleDeploy}
              disabled={!canDeploy}
              size="lg"
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-12 py-6 text-lg font-semibold"
            >
              {deployMutation.isPending ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Starting Deployment...
                </>
              ) : (
                <>
                  <Rocket className="mr-3 h-5 w-5" />
                  Deploy Now
                </>
              )}
            </Button>
            
            {!canDeploy && repoUrl && (
              <p className="text-red-400 text-sm mt-2">
                Please enter a valid GitHub repository URL
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Deploy Modal */}
      {selectedDeployment && (
        <DeployModal
          isOpen={!!selectedDeployment}
          onClose={() => setSelectedDeployment(null)}
          deploymentId={selectedDeployment}
        />
      )}
    </div>
  );
}