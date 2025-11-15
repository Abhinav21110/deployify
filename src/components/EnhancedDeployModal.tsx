import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, GitBranch, Cloud, Settings, Zap, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  apiClient, 
  queryKeys, 
  DeploymentRequest,
  DeploymentResponse,
  Provider,
  Credential,
  ProviderRecommendation 
} from '@/lib/api';
import { toast } from 'sonner';

interface EnhancedDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (deploymentId: string) => void;
}

export const EnhancedDeployModal: React.FC<EnhancedDeployModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState<Partial<DeploymentRequest>>({
    repoUrl: '',
    branch: 'main',
    environment: 'school',
    budget: 'free',
    config: {
      name: '',
      buildCommand: '',
      buildDirectory: '',
      environmentVariables: {},
    },
  });
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedCredential, setSelectedCredential] = useState<string>('');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [useAutoDetect, setUseAutoDetect] = useState(true);

  // Queries
  const { data: providersData, isLoading: loadingProviders } = useQuery({
    queryKey: queryKeys.providers(),
    queryFn: () => apiClient.getProviders(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: credentialsData, isLoading: loadingCredentials } = useQuery({
    queryKey: queryKeys.credentials(),
    queryFn: () => apiClient.getUserCredentials(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutations
  const deployMutation = useMutation({
    mutationFn: (data: DeploymentRequest) => apiClient.createDeployment(data),
    onSuccess: (response) => {
      toast.success(`Deployment ${(response as DeploymentResponse).deploymentId} has been queued successfully!`);
      queryClient.invalidateQueries({ queryKey: queryKeys.deployments(1) });
      onSuccess?.((response as DeploymentResponse).deploymentId);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create deployment');
    },
  });

  const providers = providersData?.providers || [];
  const credentials = credentialsData?.credentials || [];

  // Filter credentials for selected provider
  const availableCredentials = credentials.filter(
    cred => cred.provider === selectedProvider && cred.isActive
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.repoUrl) {
      toast.error('Please provide a repository URL');
      return;
    }

    // Prepare deployment data
    const deploymentData: DeploymentRequest = {
      ...formData,
      provider: selectedProvider || undefined,
      credentialId: selectedCredential || undefined,
      config: {
        ...formData.config,
        environmentVariables: envVars.reduce((acc, { key, value }) => {
          if (key && value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      },
    } as DeploymentRequest;

    deployMutation.mutate(deploymentData);
  };

  // Add environment variable
  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  // Remove environment variable
  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  // Update environment variable
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = envVars.map((env, i) => 
      i === index ? { ...env, [field]: value } : env
    );
    setEnvVars(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Create New Deployment
          </CardTitle>
          <CardDescription>
            Deploy your GitHub repository with intelligent provider selection
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="provider">Provider & Credentials</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Config</TabsTrigger>
              </TabsList>

              {/* Basic Settings Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="repoUrl">Repository URL *</Label>
                    <Input
                      id="repoUrl"
                      type="url"
                      placeholder="https://github.com/username/repository"
                      value={formData.repoUrl}
                      onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch</Label>
                      <Input
                        id="branch"
                        placeholder="main"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="environment">Environment</Label>
                      <Select
                        value={formData.environment}
                        onValueChange={(value) => setFormData({ ...formData, environment: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="school">School (Free)</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="prod">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Preference</Label>
                    <Select
                      value={formData.budget}
                      onValueChange={(value) => setFormData({ ...formData, budget: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Tier Only</SelectItem>
                        <SelectItem value="low">Low Cost ($5-20/month)</SelectItem>
                        <SelectItem value="any">Any Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Deployment Name</Label>
                    <Input
                      id="name"
                      placeholder="my-awesome-app"
                      value={formData.config?.name || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, name: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Provider & Credentials Tab */}
              <TabsContent value="provider" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-detect"
                      checked={useAutoDetect}
                      onCheckedChange={setUseAutoDetect}
                    />
                    <Label htmlFor="auto-detect">Auto-detect optimal provider</Label>
                  </div>

                  {!useAutoDetect && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Provider</Label>
                        {loadingProviders ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading providers...
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            {providers.map((provider) => (
                              <Card 
                                key={provider.type}
                                className={`p-3 cursor-pointer border-2 transition-colors ${
                                  selectedProvider === provider.type
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                                onClick={() => setSelectedProvider(provider.type)}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-medium">{provider?.name || provider.type}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Max size: {provider.maxFileSize}MB
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    {provider.supportsFreeTier && (
                                      <Badge variant="secondary">Free Tier</Badge>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      {selectedProvider && (
                        <div className="space-y-2">
                          <Label>Credentials (Optional)</Label>
                          {loadingCredentials ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading credentials...
                            </div>
                          ) : availableCredentials.length > 0 ? (
                            <Select
                              value={selectedCredential}
                              onValueChange={setSelectedCredential}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Auto-select first available" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCredentials.map((cred) => (
                                  <SelectItem key={cred.id} value={cred.id}>
                                    <div className="flex items-center gap-2">
                                      {cred.name}
                                      {cred.isValid && (
                                        <Badge variant="secondary" className="text-xs">
                                          Valid
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                No credentials found for {selectedProvider}. Add credentials in Settings - deployment will fail without valid credentials.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {useAutoDetect && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        The system will automatically select the best provider and use your first available credential for that provider.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              {/* Advanced Config Tab */}
              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="build-cmd">Custom Build Command</Label>
                      <Input
                        id="build-cmd"
                        placeholder="npm run build"
                        value={formData.config?.buildCommand || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          config: { ...formData.config, buildCommand: e.target.value }
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="build-dir">Build Directory</Label>
                      <Input
                        id="build-dir"
                        placeholder="dist"
                        value={formData.config?.buildDirectory || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          config: { ...formData.config, buildDirectory: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Environment Variables</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addEnvVar}>
                        Add Variable
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {envVars.map((env, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="KEY"
                            value={env.key}
                            onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                          />
                          <Input
                            placeholder="value"
                            value={env.value}
                            onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeEnvVar(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {activeTab !== 'advanced' && (
              <Button
                variant="outline"
                onClick={() => {
                  const tabs = ['basic', 'provider', 'advanced'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1]);
                  }
                }}
              >
                Next
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={deployMutation.isPending || !formData.repoUrl}
              className="min-w-32"
            >
              {deployMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};