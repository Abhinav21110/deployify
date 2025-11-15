import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Key, Shield, AlertCircle, CheckCircle, Plus, Trash2, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  apiClient, 
  queryKeys, 
  Provider, 
  Credential,
  CreateCredentialDto,
  UpdateCredentialDto 
} from '@/lib/api';
import { toast } from 'sonner';

export const CredentialsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [credentialForm, setCredentialForm] = useState<Record<string, any>>({});
  const [credentialName, setCredentialName] = useState('');

  // Queries
  const { data: providersData, isLoading: loadingProviders } = useQuery({
    queryKey: queryKeys.providers(),
    queryFn: () => apiClient.getProviders(),
  });

  const { data: credentialsData, isLoading: loadingCredentials, refetch: refetchCredentials } = useQuery({
    queryKey: queryKeys.credentials(),
    queryFn: () => apiClient.getUserCredentials(),
  });

  const { data: providerRequirements, isLoading: loadingRequirements } = useQuery({
    queryKey: queryKeys.providerRequirements(selectedProvider),
    queryFn: () => apiClient.getProviderRequirements(selectedProvider),
    enabled: !!selectedProvider,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateCredentialDto) => apiClient.createCredentials(data),
    onSuccess: (response) => {
      toast.success(`Successfully created ${(response as any).credential.name} credentials`);
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials() });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create credentials');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCredentialDto }) => 
      apiClient.updateCredentials(id, data),
    onSuccess: (response) => {
      toast.success(`Successfully updated ${(response as any).credential.name} credentials`);
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials() });
      setEditingCredential(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update credentials');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCredentials(id),
    onSuccess: () => {
      toast.success('Successfully deleted credentials');
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials() });
    },
    onError: (error: any) => {
      toast.error('Failed to delete credentials');
    },
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => apiClient.validateCredentials(id),
    onSuccess: (result, credentialId) => {
      if ((result as any).isValid) {
        toast.success('Provider credentials are valid');
      } else {
        toast.error((result as any).error || 'Provider credentials validation failed');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials() });
    },
    onError: (error: any) => {
      toast.error('Failed to validate credentials');
    },
  });

  const providers = providersData?.providers || [];
  const credentials = credentialsData?.credentials || [];

  // Add safety check for providers
  const safeProviders = providers.filter(provider => provider && (provider.name || provider.type));

  const resetForm = () => {
    setSelectedProvider('');
    setCredentialForm({});
    setCredentialName('');
  };

  const handleCreateCredentials = () => {
    if (!selectedProvider || !credentialName) {
      toast.error('Please select a provider and provide a name');
      return;
    }

    const requirements = providerRequirements?.requirements;
    if (!requirements) return;

    // Validate required fields
    const missingFields = requirements.credentialFields.filter(field => !credentialForm[field]);
    if (missingFields.length > 0) {
      toast.error(`Please fill in the required fields: ${missingFields.join(', ')}`);
      return;
    }

    createMutation.mutate({
      provider: selectedProvider,
      name: credentialName,
      credentials: credentialForm,
    });
  };

  const handleEditCredentials = (credential: Credential) => {
    setEditingCredential(credential);
    setCredentialName(credential.name || '');
    // Note: We don't pre-fill credential values for security reasons
  };

  const handleUpdateCredentials = () => {
    if (!editingCredential) return;

    updateMutation.mutate({
      id: editingCredential.id,
      data: {
        name: credentialName,
        // Only include credentials if they were changed
        ...(Object.keys(credentialForm).length > 0 && { credentials: credentialForm }),
      },
    });
  };

  const getProviderIcon = (providerType: string) => {
    switch (providerType) {
      case 'netlify':
        return '🟢'; // Green circle for Netlify
      case 'vercel':
        return '⚫'; // Black circle for Vercel
      default:
        return '☁️'; // Cloud for others
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deployment Credentials</h2>
          <p className="text-muted-foreground">
            Manage your provider API keys and authentication tokens
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Credentials
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Provider Credentials</DialogTitle>
              <DialogDescription>
                Configure API credentials for a deployment provider
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                {loadingProviders ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading providers...
                  </div>
                ) : (
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeProviders.map((provider, index) => (
                        <SelectItem key={provider.type || `provider-${index}`} value={provider.type}>
                          <div className="flex items-center gap-2">
                            <span>{getProviderIcon(provider.type)}</span>
                            {provider?.name || provider.type}
                            {provider.supportsFreeTier && (
                              <Badge variant="secondary" className="ml-2">Free Tier</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedProvider && (
                <>
                  <div className="space-y-2">
                    <Label>Credential Name</Label>
                    <Input
                      placeholder="My Netlify Account"
                      value={credentialName}
                      onChange={(e) => setCredentialName(e.target.value)}
                    />
                  </div>

                  {loadingRequirements ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading requirements...
                    </div>
                  ) : providerRequirements && (
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Provider Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Max file size:</span>
                            <span className="ml-2">{providerRequirements.info.maxFileSize}MB</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Free tier:</span>
                            <span className="ml-2">
                              {providerRequirements.info.supportsFreeTier ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium">Required Credentials</h4>
                        {providerRequirements.requirements.credentialFields.map((field) => (
                          <div key={field} className="space-y-2">
                            <Label htmlFor={field}>
                              {field.split(/(?=[A-Z])/).join(' ')} *
                            </Label>
                            <Input
                              id={field}
                              type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                              placeholder={`Enter ${field}`}
                              value={credentialForm[field] || ''}
                              onChange={(e) => 
                                setCredentialForm({
                                  ...credentialForm,
                                  [field]: e.target.value
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>

                      {providerRequirements.requirements.credentialFields.includes('accessToken') && (
                        <Alert>
                          <Shield className="h-4 w-4" />
                          <AlertDescription>
                            Access tokens are encrypted and stored securely. They are only used for deployments and cannot be viewed after creation.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCredentials}
                disabled={createMutation.isPending || !selectedProvider || !credentialName}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Add Credentials'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Credentials */}
      <div className="grid gap-4">
        {loadingCredentials ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading credentials...
              </div>
            </CardContent>
          </Card>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Credentials Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add provider credentials to enable deployments to external platforms
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                Add Your First Credentials
              </Button>
            </CardContent>
          </Card>
        ) : (
          credentials.map((credential) => (
            <Card key={credential.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getProviderIcon(credential.provider)}</span>
                    <div>
                      <CardTitle className="text-lg">{credential.name}</CardTitle>
                      <CardDescription>
                        {credential.provider} • Created {new Date(credential.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {credential.isValid ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Invalid
                      </Badge>
                    )}
                    {!credential.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateMutation.mutate(credential.id)}
                    disabled={validateMutation.isPending}
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    Validate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCredentials(credential)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(credential.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Edit Credential Dialog */}
      <Dialog open={!!editingCredential} onOpenChange={() => setEditingCredential(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credentials</DialogTitle>
            <DialogDescription>
              Update the name or replace credentials for {editingCredential?.provider}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Credential Name</Label>
              <Input
                value={credentialName}
                onChange={(e) => setCredentialName(e.target.value)}
              />
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                For security reasons, existing credential values are not shown. Only fill the fields below if you want to replace the credentials.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCredential(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateCredentials}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Credentials'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};